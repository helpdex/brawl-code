import { NodeServices } from "@effect/platform-node"
import { EffectFlock } from "@opencode/util/effect-flock"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Global } from "@opencode/util/global"
import { AppProcess } from "@opencode/util/process"
import { expect } from "bun:test"
import { Effect, Layer } from "effect"
import { createHash } from "node:crypto"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import os from "node:os"
import path from "node:path"
import { gzipSync } from "node:zlib"
import { BrawlUpdater } from "../../src/brawl/updater"
import { Updater } from "../../src/services/updater"
import { testEffect } from "../../../core/test/lib/effect"

const it = testEffect(NodeServices.layer)

const version = Bun.version
const target = "test-target"
const binary = readFileSync(process.execPath)
const archive = gzipSync(binary, { level: 1 })
const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex")

type Site = { latest?: string; sums?: (requested: string) => string }

const fixture = (input: { site?: Site; options?: Partial<BrawlUpdater.Options>; installed?: boolean } = {}) =>
  Effect.gen(function* () {
    const root = yield* Effect.acquireRelease(
      Effect.sync(() => mkdtempSync(path.join(os.tmpdir(), "brawl-updater-"))),
      (dir) => Effect.sync(() => rmSync(dir, { recursive: true, force: true })),
    )
    const requests: string[] = []
    const server = yield* Effect.acquireRelease(
      Effect.sync(() =>
        Bun.serve({
          port: 0,
          hostname: "127.0.0.1",
          fetch: (request) => {
            const url = new URL(request.url)
            requests.push(url.pathname)
            if (url.pathname === "/dl/brawl-code/latest") return new Response(`${input.site?.latest ?? version}\n`)
            const match = url.pathname.match(/^\/dl\/brawl-code\/([^/]+)\/(.+)$/)
            if (match?.[2] === "SHA256SUMS")
              return new Response(input.site?.sums?.(match[1]) ?? `${sha256(archive)}  ${BrawlUpdater.asset(target)}\n`)
            if (match?.[2] === BrawlUpdater.asset(target)) return new Response(archive)
            return new Response("not found", { status: 404 })
          },
        }),
      ),
      (server) => Effect.promise(() => server.stop(true)),
    )
    const global = Global.make({
      home: path.join(root, "home"),
      data: path.join(root, "data"),
      cache: path.join(root, "cache"),
      config: path.join(root, "config"),
      state: path.join(root, "state"),
      tmp: path.join(root, "tmp"),
      bin: path.join(root, "bin"),
      log: path.join(root, "log"),
      repos: path.join(root, "repos"),
    })
    const installed = BrawlUpdater.installPath(global.home)
    mkdirSync(path.dirname(installed), { recursive: true })
    mkdirSync(global.config, { recursive: true })
    if (input.installed !== false) copyFileSync(process.execPath, installed)
    const updater = yield* Updater.Service.pipe(
      Effect.provide(
        BrawlUpdater.layerWith({
          target,
          site: server.url.origin,
          executable: installed,
          version: "0.0.1",
          local: false,
          ...input.options,
        }),
      ),
      Effect.provide(
        LayerNode.compile(LayerNode.group([AppProcess.node, EffectFlock.node]), {
          replacements: [Global.node.replace(Layer.succeed(Global.Service, global))],
        }),
      ),
      Effect.provideService(Global.Service, global),
    )
    return { updater, installed, global, requests, root }
  })

const leftovers = (installed: string) =>
  readdirSync(path.dirname(installed)).filter((name) => name !== path.basename(installed) && !name.includes(".old-"))

it.live("only the copy in ~/.local/bin with a release target updates itself", () =>
  Effect.gen(function* () {
    expect(yield* (yield* fixture()).updater.method()).toBe("brawl")
    const elsewhere = yield* fixture({ options: { executable: path.join(os.tmpdir(), "brawl-code") } })
    expect(yield* elsewhere.updater.method()).toBeUndefined()
    const source = yield* fixture({ options: { target: undefined } })
    expect(yield* source.updater.method()).toBeUndefined()
  }),
)

it.live("latest is the version the site names", () =>
  Effect.gen(function* () {
    expect(yield* (yield* fixture()).updater.latest()).toBe(version)
    const junk = yield* fixture({ site: { latest: "<html>" } })
    const error = yield* junk.updater.latest().pipe(Effect.flip)
    expect(error.message).toContain("instead of a version")
  }),
)

it.live("upgrade puts the checked download in place of the installed binary while it runs", () =>
  Effect.gen(function* () {
    const test = yield* fixture()
    const before = statSync(test.installed).ino
    const running = Bun.spawn([test.installed, "-e", "await Bun.sleep(60_000)"], { stdout: "ignore", stderr: "ignore" })
    yield* Effect.addFinalizer(() => Effect.sync(() => running.kill()))
    yield* test.updater.upgrade("brawl", `v${version}`)
    expect(sha256(readFileSync(test.installed))).toBe(sha256(binary))
    expect(running.exitCode).toBeNull()
    expect(leftovers(test.installed)).toEqual([])
    const aside = readdirSync(path.dirname(test.installed)).filter((name) => name.includes(".old-"))
    if (process.platform === "win32") expect(aside).toHaveLength(1)
    else {
      expect(aside).toEqual([])
      expect(statSync(test.installed).ino).not.toBe(before)
    }
    expect(test.requests).toEqual([
      `/dl/brawl-code/${version}/SHA256SUMS`,
      `/dl/brawl-code/${version}/${BrawlUpdater.asset(target)}`,
    ])
  }),
)

it.live("upgrade refuses a damaged download and keeps the installed binary", () =>
  Effect.gen(function* () {
    const test = yield* fixture({ site: { sums: () => `${"0".repeat(64)}  ${BrawlUpdater.asset(target)}\n` } })
    const before = statSync(test.installed).ino
    const error = yield* test.updater.upgrade("brawl", version).pipe(Effect.flip)
    expect(error.message).toContain("SHA256SUMS says")
    expect(statSync(test.installed).ino).toBe(before)
    expect(leftovers(test.installed)).toEqual([])
  }),
)

it.live("upgrade refuses a release without a file for this system", () =>
  Effect.gen(function* () {
    const test = yield* fixture({ site: { sums: () => `${sha256(archive)}  brawl-code-other.gz\n` } })
    const error = yield* test.updater.upgrade("brawl", version).pipe(Effect.flip)
    expect(error).toBeInstanceOf(Updater.UpgradeError)
    if (error instanceof Updater.UpgradeError) expect(error.title).toContain("has no file for this system")
  }),
)

it.live("upgrade refuses a binary that reports another version", () =>
  Effect.gen(function* () {
    const test = yield* fixture()
    const before = statSync(test.installed).ino
    const error = yield* test.updater.upgrade("brawl", "9.9.9").pipe(Effect.flip)
    expect(error).toBeInstanceOf(Updater.UpgradeError)
    if (error instanceof Updater.UpgradeError) {
      expect(error.title).toBe("Brawl Code 9.9.9 does not start on this system")
      expect(error.detail).toContain(`reported ${version}`)
    }
    expect(statSync(test.installed).ino).toBe(before)
    expect(leftovers(test.installed)).toEqual([])
  }),
)

it.live("a newer version is announced, checked and installed on request", () =>
  Effect.gen(function* () {
    const test = yield* fixture()
    expect(yield* test.updater.run()).toEqual({ type: "available", version })
    expect(yield* test.updater.check()).toEqual({ type: "available", version })
    yield* test.updater.apply(version)
    expect(sha256(readFileSync(test.installed))).toBe(sha256(binary))
    expect(yield* test.updater.check()).toEqual({ type: "installed", version })
  }),
)

it.live("auto installs the update and disable stops the checks", () =>
  Effect.gen(function* () {
    const auto = yield* fixture()
    writeFileSync(path.join(auto.global.config, "opencode.json"), JSON.stringify({ update: "auto" }))
    const installing: string[] = []
    expect(yield* auto.updater.run((next) => installing.push(next))).toEqual({ type: "installed", version })
    expect(installing).toEqual([version])

    const off = yield* fixture()
    writeFileSync(path.join(off.global.config, "opencode.json"), JSON.stringify({ update: "disable" }))
    expect(yield* off.updater.run()).toBeUndefined()
    expect(off.requests).toEqual([])
  }),
)

it.live("copies outside ~/.local/bin are not told about updates and can't apply them", () =>
  Effect.gen(function* () {
    const test = yield* fixture({ options: { executable: path.join(os.tmpdir(), "brawl-code") } })
    expect(yield* test.updater.run()).toBeUndefined()
    expect(yield* test.updater.check()).toEqual({ type: "unavailable", message: BrawlUpdater.unmanaged })
    const error = yield* test.updater.apply(version).pipe(Effect.flip)
    expect(error.message).toBe(BrawlUpdater.unmanaged)
    expect(test.requests).toEqual([])
    expect(existsSync(`${test.installed}.download`)).toBe(false)
  }),
)
