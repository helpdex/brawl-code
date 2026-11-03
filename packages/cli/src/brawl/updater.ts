export * as BrawlUpdater from "./updater"

import { Brawl } from "@opencode/util/brawl"
import { EffectFlock } from "@opencode/util/effect-flock"
import { Global } from "@opencode/util/global"
import { AppProcess } from "@opencode/util/process"
import { Duration, Effect, FileSystem, Layer, Ref } from "effect"
import { ChildProcess } from "effect/process"
import { createHash } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import path from "node:path"
import { pipeline } from "node:stream/promises"
import { createGunzip } from "node:zlib"
import { Updater } from "../services/updater"
import { action, parseReleaseVersion } from "../services/updater-action"
import { OPENCODE_LOCAL, OPENCODE_VERSION } from "../version"

declare const BRAWL_TARGET: string

const builtTarget = typeof BRAWL_TARGET === "string" ? BRAWL_TARGET : undefined

export const unmanaged = `${Brawl.name} updates itself when brawl code installed it. Run brawl code to install or update it.`

export type Options = {
  readonly target?: string
  readonly site?: string
  readonly executable?: string
  readonly version?: string
  readonly local?: boolean
}

export const installPath = (home: string) =>
  path.join(home, ".local", "bin", process.platform === "win32" ? `${Brawl.command}.exe` : Brawl.command)

export const asset = (target: string) => `${Brawl.command}-${target}.gz`

const failure = (
  title: string,
  detail: string,
  retry = `Check your network, then run ${Brawl.command} upgrade again.`,
) => new Updater.UpgradeError({ title, detail, retry })

const describe = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause))

const make = (options: Options) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const global = yield* Global.Service
    const appProcess = yield* AppProcess.Service
    const flock = yield* EffectFlock.Service
    const target = "target" in options ? options.target : builtTarget
    const site = (options.site ?? Brawl.site).replace(/\/+$/, "")
    const local = options.local ?? OPENCODE_LOCAL
    const running = options.version ?? OPENCODE_VERSION
    const installedVersion = yield* Ref.make(running)
    const destination = installPath(global.home)
    const real = (file: string) =>
      fs.realPath(file).pipe(
        Effect.orElseSucceed(() => path.resolve(file)),
        Effect.map((resolved) => (process.platform === "win32" ? resolved.toLowerCase() : resolved)),
      )
    const executable = yield* real(options.executable ?? process.execPath)
    const managed = target !== undefined && executable === (yield* real(destination))

    const method = () => Effect.succeed<Updater.Method | undefined>(managed ? "brawl" : undefined)

    const get = (url: string, title: string) =>
      Effect.tryPromise({
        try: async (signal) => {
          const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) })
          if (!response.ok) throw new Error(`${url} answered HTTP ${response.status}`)
          return response.text()
        },
        catch: (cause) => failure(title, describe(cause)),
      })

    const latest = () =>
      get(`${site}/dl/brawl-code/latest`, `Could not check for ${Brawl.name} updates`).pipe(
        Effect.map((text) => text.trim()),
        Effect.filterOrFail(
          (version) => /^\d+\.\d+\.\d+$/.test(version) && parseReleaseVersion(version) !== undefined,
          (version) =>
            failure(
              `Could not read the ${Brawl.name} update information`,
              `${site}/dl/brawl-code/latest holds "${version.slice(0, 40)}" instead of a version.`,
              "Try again in a few minutes.",
            ),
        ),
      )

    const checksum = (sums: string, file: string) =>
      sums
        .split("\n")
        .map((line) => line.trim().split(/\s+/))
        .find((parts) => parts.length === 2 && parts[1].replace(/^\*/, "") === file)?.[0]
        ?.toLowerCase()

    const download = (url: string, file: string) =>
      Effect.tryPromise({
        try: async (signal) => {
          const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(900_000)]) })
          if (!response.ok || !response.body) throw new Error(`${url} answered HTTP ${response.status}`)
          const hash = createHash("sha256")
          const sink = Bun.file(file).writer()
          try {
            for await (const chunk of response.body) {
              hash.update(chunk)
              await sink.write(chunk)
            }
          } finally {
            await sink.end()
          }
          return hash.digest("hex")
        },
        catch: (cause) => failure(`Could not download ${Brawl.name}`, describe(cause)),
      })

    const unpack = (source: string, file: string) =>
      Effect.tryPromise({
        try: () => pipeline(createReadStream(source), createGunzip(), createWriteStream(file, { mode: 0o755 })),
        catch: (cause) =>
          failure(`Could not unpack ${Brawl.name}`, describe(cause), `Run ${Brawl.command} upgrade again.`),
      })

    const verify = (file: string, version: string) =>
      appProcess.run(ChildProcess.make(file, ["--version"]), { timeout: "1 minute", maxOutputBytes: 10_000 }).pipe(
        Effect.mapError((cause) =>
          failure(
            `${Brawl.name} ${version} does not start on this system`,
            describe(cause),
            `Install it again with brawl code.`,
          ),
        ),
        Effect.flatMap((result) => {
          const reported = result.stdout.toString("utf8").match(/\d+\.\d+\.\d+\S*/)?.[0]
          if (result.exitCode === 0 && reported === version) return Effect.void
          return Effect.fail(
            failure(
              `${Brawl.name} ${version} does not start on this system`,
              `It exited with code ${result.exitCode} and reported ${reported ?? "no version"}.`,
              `Install it again with brawl code.`,
            ),
          )
        }),
      )

    const swap = (next: string) =>
      Effect.gen(function* () {
        if (process.platform === "win32") {
          const directory = path.dirname(destination)
          const stale = (yield* fs.readDirectory(directory)).filter((name) =>
            name.startsWith(`${path.basename(destination)}.old-`),
          )
          yield* Effect.forEach(stale, (name) => fs.remove(path.join(directory, name)).pipe(Effect.ignore))
          if (yield* fs.exists(destination)) yield* fs.rename(destination, `${destination}.old-${Date.now()}`)
        }
        yield* fs.rename(next, destination)
      }).pipe(
        Effect.mapError((cause) =>
          failure(
            `Could not replace ${destination}`,
            describe(cause),
            `Close other ${Brawl.name} windows, then run ${Brawl.command} upgrade again.`,
          ),
        ),
      )

    const upgrade = Effect.fnUntraced(function* (selected: Updater.Method, input: string) {
      if (selected !== "brawl" || target === undefined) return yield* Effect.fail(new Error(unmanaged))
      const version = input.trim().replace(/^v/, "")
      if (!/^\d+\.\d+\.\d+$/.test(version)) return yield* Effect.fail(new Error(`Invalid version: ${input}`))
      const file = asset(target)
      const base = `${site}/dl/brawl-code/${version}`
      const archive = `${destination}.download`
      const next = destination.replace(/(\.exe)?$/, ".new$1")
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* flock.acquire("cli-upgrade", undefined, { timeoutMs: Duration.toMillis("20 minutes") })
          const expected = checksum(yield* get(`${base}/SHA256SUMS`, `Could not download ${Brawl.name}`), file)
          if (!expected)
            return yield* Effect.fail(
              failure(
                `${Brawl.name} ${version} has no file for this system`,
                `${base}/SHA256SUMS does not list ${file}.`,
              ),
            )
          yield* fs.makeDirectory(path.dirname(destination), { recursive: true })
          const actual = yield* download(`${base}/${file}`, archive)
          if (actual !== expected)
            return yield* Effect.fail(
              failure(
                `The downloaded ${Brawl.name} ${version} is damaged`,
                `${file} has sha256 ${actual}, SHA256SUMS says ${expected}.`,
              ),
            )
          yield* unpack(archive, next)
          if (process.platform !== "win32") yield* fs.chmod(next, 0o755)
          yield* verify(next, version)
          yield* swap(next)
        }).pipe(
          Effect.ensuring(
            Effect.all([fs.remove(archive, { force: true }), fs.remove(next, { force: true })]).pipe(Effect.ignore),
          ),
        ),
      )
      yield* Ref.set(installedVersion, version)
      yield* Effect.logInfo("updated Brawl Code", { to: version, target })
    })

    const readPolicy = Effect.fnUntraced(function* () {
      const values = yield* Effect.forEach(["config.json", "opencode.json", "opencode.jsonc"], (name) =>
        fs.readFileString(path.join(global.config, name)).pipe(
          Effect.map(Updater.decodePolicy),
          Effect.orElseSucceed(() => undefined),
        ),
      )
      return values.findLast((value) => value !== undefined) ?? "notify"
    })

    const disabled = () => ["1", "true"].includes(process.env.OPENCODE_DISABLE_AUTOUPDATE?.toLowerCase() ?? "")

    const run = Effect.fn("cli.updater.run")(
      function* (onInstall: (version: string) => void = () => {}) {
        if (local || disabled() || !managed) return undefined
        const policy = yield* readPolicy()
        if (policy === "disable") return undefined
        const version = yield* latest()
        const next = action(yield* Ref.get(installedVersion), version, policy)
        if (next === "none") return undefined
        if (next === "notify") return { type: "available" as const, version }
        onInstall(version)
        yield* upgrade("brawl", version)
        return { type: "installed" as const, version }
      },
      Effect.catch((error) => Effect.logWarning("update check failed", { error }).pipe(Effect.as(undefined))),
    )

    const check = Effect.fn("cli.updater.check")(function* () {
      if (local)
        return {
          type: "unavailable" as const,
          message: `This build runs from a source checkout. Use an installed ${Brawl.name} to check for updates.`,
        }
      if (!managed) return { type: "unavailable" as const, message: unmanaged }
      const version = yield* latest()
      const current = yield* Ref.get(installedVersion)
      if (action(current, version, "auto") === "none")
        return action(running, current, "auto") === "none"
          ? undefined
          : { type: "installed" as const, version: current }
      return { type: "available" as const, version }
    })

    const apply = Effect.fn("cli.updater.apply")(function* (version: string) {
      if (!managed) return yield* Effect.fail(new Error(unmanaged))
      yield* upgrade("brawl", version)
    })

    return Updater.Service.of({
      run,
      check,
      apply,
      method,
      latest: () => latest(),
      upgrade,
      removal: () => undefined,
    })
  })

export const layerWith = (options: Options) => Layer.effect(Updater.Service, make(options))
export const layer = layerWith({})
