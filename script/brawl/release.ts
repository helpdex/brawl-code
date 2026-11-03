#!/usr/bin/env bun

import { $ } from "bun"
import { createHash } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import { mkdir, readdir, rm, stat } from "node:fs/promises"
import path from "node:path"
import { pipeline } from "node:stream/promises"
import { createGzip } from "node:zlib"

const root = path.resolve(import.meta.dir, "../..")
const cli = path.join(root, "packages", "cli")
const args = process.argv.slice(2)
const version = args.find((arg) => !arg.startsWith("--"))
const targets = args
  .find((arg) => arg.startsWith("--targets="))
  ?.slice("--targets=".length)
  .split(",")
  .filter(Boolean)

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("usage: bun script/brawl/release.ts <x.y.z> [--targets=darwin-arm64,linux-x64] [--dirty]")
  process.exit(2)
}
if ((await $`git status --porcelain`.cwd(root).text()).trim() && !args.includes("--dirty")) {
  console.error("The tree has uncommitted changes: commit them, or pass --dirty for a build that is not released.")
  process.exit(1)
}

const commit = (await $`git rev-parse --short=10 HEAD`.cwd(root).text()).trim()
const bun = (await Bun.file(path.join(root, "package.json")).json()).packageManager.split("@")[1]
const build = path.join(cli, "dist", "release")
const out = path.join(root, "dist", "brawl-code", version)
const env = {
  ...process.env,
  OPENCODE_VERSION: version,
  OPENCODE_CHANNEL: "latest",
  BUN_COMPILE_RELEASE: `bun-v${bun}`,
}

await rm(build, { recursive: true, force: true })
await rm(out, { recursive: true, force: true })
if (targets)
  for (const target of targets)
    await $`bun run script/build.ts ${`--outdir=${path.join("dist", "release", target)}`}`
      .cwd(cli)
      .env({ ...env, OPENCODE_TARGET: target })
else await $`bun run script/build.ts --outdir=dist/release`.cwd(cli).env(env)

const binaries = (await readdir(build, { recursive: true }))
  .map((file) => file.split(path.sep).join("/"))
  .flatMap((file) => {
    const match = file.match(/(?:^|\/)cli-([^/]+)\/bin\/brawl-code(?:\.exe)?$/)
    return match ? [{ target: match[1], file: path.join(build, file) }] : []
  })
  .toSorted((a, b) => a.target.localeCompare(b.target))
if (!binaries.length || (targets && binaries.length !== targets.length))
  throw new Error(`Expected ${targets?.length ?? "all"} binaries in ${build}, found ${binaries.length}`)

await mkdir(out, { recursive: true })
const files = await Promise.all(
  binaries.map(async ({ target, file }) => {
    const name = `brawl-code-${target}.gz`
    await pipeline(createReadStream(file), createGzip({ level: 9 }), createWriteStream(path.join(out, name)))
    const hash = createHash("sha256")
    for await (const chunk of createReadStream(path.join(out, name))) hash.update(chunk)
    return { target, file, name, sha256: hash.digest("hex") }
  }),
)
await Bun.write(path.join(out, "SHA256SUMS"), files.map((item) => `${item.sha256}  ${item.name}\n`).join(""))

const host = `${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`
for (const item of files) {
  const command =
    item.target === host
      ? [item.file]
      : process.platform === "darwin" && process.arch === "arm64" && item.target === "darwin-x64"
        ? ["arch", "-x86_64", item.file]
        : undefined
  if (!command) continue
  const reported = (await $`${command} --version`.text()).trim()
  if (reported !== `brawl-code v${version}`) throw new Error(`${item.target} reports "${reported}"`)
  console.log(`${item.target}: ${reported}`)
}

const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`
for (const item of files)
  console.log(
    `${item.name.padEnd(42)} ${mb((await stat(item.file)).size).padStart(9)} → ${mb((await stat(path.join(out, item.name))).size).padStart(8)}`,
  )
console.log(`Brawl Code ${version} from ${commit}: ${out}`)
