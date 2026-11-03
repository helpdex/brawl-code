import path from "node:path"
import { readFile } from "node:fs/promises"
import type { BunPlugin } from "bun"
import { localize } from "../../../tui/src/brawl/localize"
import { ru } from "../../../tui/src/brawl/ru"
import { spots } from "../../../tui/src/brawl/spots"

const tui = path.resolve(import.meta.dir, "../../../tui/src")
const i18n = path.join(tui, "brawl", "i18n.ts")

const solid = path.join(
  path.dirname(Bun.resolveSync("@opentui/solid/bun-plugin", import.meta.dir)),
  "solid-transform.js",
)
const { transformSolidSource } = (await import(solid)) as {
  transformSolidSource: (code: string, options: { filename: string; moduleName: string }) => Promise<string>
}

export const localizePlugin: BunPlugin = {
  name: "brawl-localize",
  setup(build) {
    build.onLoad({ filter: /[/\\]packages[/\\]tui[/\\]src[/\\].+\.tsx?$/ }, async (args) => {
      const source = await readFile(args.path, "utf8")
      const code = args.path.startsWith(path.join(tui, "brawl")) ? source : localize(source, args.path, ru, spots, i18n)
      if (!args.path.endsWith(".tsx")) return { contents: code, loader: "ts" }
      return {
        contents: await transformSolidSource(code, { filename: args.path, moduleName: "@opentui/solid" }),
        loader: "js",
      }
    })
  },
}
