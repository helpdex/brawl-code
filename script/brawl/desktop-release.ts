#!/usr/bin/env bun

import { createHash } from "node:crypto"
import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises"
import path from "node:path"

const root = path.resolve(import.meta.dir, "../..")
const args = process.argv.slice(2)
const version = args.find((arg) => !arg.startsWith("--"))
const from = args.find((arg) => arg.startsWith("--from="))?.slice("--from=".length)
const base = `https://brawl.io/dl/brawl-code-desktop/${version}`

if (!version || !/^\d+\.\d+\.\d+$/.test(version) || !from) {
  console.error("usage: bun script/brawl/desktop-release.ts <x.y.z> --from=<folder with the artifacts>")
  process.exit(2)
}

const feeds = {
  "latest.yml": ["brawl-code-desktop-win-x64.exe", "brawl-code-desktop-win-arm64.exe"],
  "latest-linux.yml": [
    "brawl-code-desktop-linux-x86_64.AppImage",
    "brawl-code-desktop-linux-amd64.deb",
    "brawl-code-desktop-linux-x86_64.rpm",
  ],
  "latest-linux-arm64.yml": [
    "brawl-code-desktop-linux-arm64.AppImage",
    "brawl-code-desktop-linux-arm64.deb",
    "brawl-code-desktop-linux-aarch64.rpm",
  ],
}
const mac = ["brawl-code-desktop-mac-arm64.dmg", "brawl-code-desktop-mac-x64.dmg"]
const names = [...Object.values(feeds).flat(), ...mac]

const found = new Map(
  (await readdir(path.resolve(from), { recursive: true }))
    .map((file) => path.join(path.resolve(from), file))
    .map((file) => [path.basename(file), file] as const),
)
const missing = names.filter((name) => !found.has(name))
if (missing.length) throw new Error(`Not in ${from}: ${missing.join(", ")}`)

const out = path.join(root, "dist", "brawl-code-desktop", version)
await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })

const info = new Map<string, { sha256: string; sha512: string; size: number }>()
for (const name of names) {
  const file = path.join(out, name)
  await copyFile(found.get(name)!, file)
  const bytes = new Uint8Array(await Bun.file(file).arrayBuffer())
  info.set(name, {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sha512: createHash("sha512").update(bytes).digest("base64"),
    size: (await stat(file)).size,
  })
}

const releaseDate = new Date().toISOString()
for (const [feed, files] of Object.entries(feeds)) {
  const entries = files.map((name) => ({
    url: `${base}/${name}`,
    sha512: info.get(name)!.sha512,
    size: info.get(name)!.size,
  }))
  await Bun.write(
    path.join(out, feed),
    JSON.stringify({ version, files: entries, path: entries[0].url, sha512: entries[0].sha512, releaseDate }, null, 2) +
      "\n",
  )
}

const sums = [...names, ...Object.keys(feeds)].map(async (name) => {
  const hash =
    info.get(name)?.sha256 ??
    createHash("sha256")
      .update(await Bun.file(path.join(out, name)).bytes())
      .digest("hex")
  return `${hash}  ${name}\n`
})
await Bun.write(path.join(out, "SHA256SUMS"), (await Promise.all(sums)).join(""))

const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`
for (const name of names) console.log(`${name.padEnd(44)} ${mb(info.get(name)!.size).padStart(9)}`)
console.log(`Brawl Code desktop ${version}: ${out}`)
