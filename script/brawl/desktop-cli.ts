#!/usr/bin/env bun

import { createHash } from "node:crypto"
import { chmod, mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { gunzipSync } from "node:zlib"
import { getCurrentCli } from "../../packages/desktop/script/utils"

const root = path.resolve(import.meta.dir, "../..")
const args = process.argv.slice(2)
const version = args.find((arg) => !arg.startsWith("--"))
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("usage: bun script/brawl/desktop-cli.ts <x.y.z> [--target=windows-x64] [--from=<dir or url>]")
  process.exit(2)
}

const cli = getCurrentCli(option("target"))
const suffix = cli.package.replace("@opencode/cli-", "")
const name = `brawl-code-${suffix}.gz`
const from = option("from") ?? `https://brawl.io/dl/brawl-code/${version}`

async function read(file: string) {
  if (!/^https?:\/\//.test(from)) return new Uint8Array(await Bun.file(path.resolve(root, from, file)).arrayBuffer())
  const response = await fetch(`${from}/${file}`)
  if (!response.ok) throw new Error(`${from}/${file}: HTTP ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

const sums = new TextDecoder().decode(await read("SHA256SUMS"))
const expected = sums
  .split("\n")
  .map((line) => line.trim().split(/\s+/))
  .find(([, file]) => file === name)?.[0]
if (!expected) throw new Error(`${name} is not in ${from}/SHA256SUMS`)

const gz = await read(name)
const actual = createHash("sha256").update(gz).digest("hex")
if (actual !== expected) throw new Error(`${name}: sha256 ${actual}, SHA256SUMS says ${expected}`)

const dir = path.join(root, "packages", "cli", "dist", `cli-${suffix}`)
const bin = path.join(dir, "bin", cli.os === "win32" ? "brawl-code.exe" : "brawl-code")
await rm(dir, { recursive: true, force: true })
await mkdir(path.dirname(bin), { recursive: true })
await Bun.write(bin, gunzipSync(gz))
if (cli.os !== "win32") await chmod(bin, 0o755)
await Bun.write(path.join(dir, "package.json"), JSON.stringify({ name: cli.package, version }, null, 2) + "\n")
console.log(`${name} ${version} (sha256 ${actual.slice(0, 12)}…) → ${path.relative(root, bin)}`)
