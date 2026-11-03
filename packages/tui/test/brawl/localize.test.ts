import { describe, expect, test } from "bun:test"
import path from "node:path"
import { counted, languageOf, patternsOf, translate } from "../../src/brawl/i18n"
import { isPhrase, localize } from "../../src/brawl/localize"
import { ru } from "../../src/brawl/ru"
import { spots as tuiSpots } from "../../src/brawl/spots"

const dictionary = {
  Search: "Поиск",
  "Connect a provider": "Подключите провайдера",
  "Connected {0}": "Подключено: {0}",
}
const spots = [{ file: /local\.tsx$/, strings: ["Connect a provider"] }]
const run = (code: string, file = "component/dialog.tsx") => localize(code, file, dictionary, spots, "/i18n.ts")

describe("localize", () => {
  test("translates JSX text, display attributes and display properties", () => {
    const out = run(`<text>Search</text>\n<Input placeholder="Search" />\nconst o = { title: "Search" }`)
    expect(out).toStartWith(`import { t as __brawl_t, tf as __brawl_tf } from "/i18n.ts"\n`)
    expect(out).toContain(`<text>{__brawl_t("Search")}</text>`)
    expect(out).toContain(`placeholder={__brawl_t("Search")}`)
    expect(out).toContain(`title: __brawl_t("Search")`)
  })

  test("turns a template literal of a dictionary pattern into tf", () => {
    expect(run("toast({ message: `Connected ${integration.name}` })")).toContain(
      `message: __brawl_tf("Connected {0}", integration.name)`,
    )
    expect(run("const s = `Connected to ${host}`")).toBe("const s = `Connected to ${host}`")
  })

  test("leaves ids, comparisons and other positions alone", () => {
    const code = `if (mode === "Search") go({ name: "Search" })\nconst label = "Search"`
    expect(run(code)).toBe(code)
  })

  test("translates the strings a file lists in its spots", () => {
    expect(run(`const x = { provider: "Connect a provider" }`, "context/local.tsx")).toContain(
      `provider: __brawl_t("Connect a provider")`,
    )
    expect(run(`const x = { kind: "Search" }`)).toBe(`const x = { kind: "Search" }`)
  })

  test("translates JSX text on its own line, before and after an expression, but not around a comparison", () => {
    expect(run(`<text>\n  Search\n</text>`)).toContain(`<text>\n  {__brawl_t("Search")}\n</text>`)
    expect(run(`<text>Search {query()}</text>`)).toContain(`<text>{__brawl_t("Search")} {query()}</text>`)
    expect(run(`<text>{count()} Search</text>`)).toContain(`<text>{count()} {__brawl_t("Search")}</text>`)
    expect(run(`if (a > Search {`)).toBe(`if (a > Search {`)
  })

  test("translates a phrase anywhere but in a comparison or an object key", () => {
    expect(run(`title: open() ? "Connect a provider" : "Search"`)).toContain(
      `title: open() ? __brawl_t("Connect a provider") : "Search"`,
    )
    expect(run(`return "Connect a provider"`)).toContain(`return __brawl_t("Connect a provider")`)
    expect(run(`toast({ title: "Connect a provider" })`)).toContain(`title: __brawl_t("Connect a provider") })`)
    expect(run(`<Hint fallback="Connect a provider" />`)).toContain(`fallback={__brawl_t("Connect a provider")}`)
    const kept = `if (x === "Connect a provider" || "Connect a provider" !== y) go({ "Connect a provider": 1 })`
    expect(run(kept)).toBe(kept)
  })

  test("translates values a file lists as expressions where they are used", () => {
    const code = `<View title={props.method.label} />\nask(dialog, method.label ?? "x")\nmethod.label.trim()`
    const spot = { file: /integration/, expressions: ["props.method.label", "method.label"] }
    const out = localize(code, "dialog-integration.tsx", dictionary, [spot], "/i18n.ts")
    expect(out).toContain(`title={__brawl_t(props.method.label)}`)
    expect(out).toContain(`ask(dialog, __brawl_t(method.label) ?? "x")`)
    expect(out).toContain(`method.label.trim()`)
  })
})

describe("translate", () => {
  const patterns = patternsOf(dictionary)

  test("an entry, then a pattern the text fills, else the text", () => {
    expect(translate("Search", dictionary, patterns)).toBe("Поиск")
    expect(translate("Connected Brawl", dictionary, patterns)).toBe("Подключено: Brawl")
    expect(translate("Disconnected", dictionary, patterns)).toBe("Disconnected")
    expect(translate(undefined, dictionary, patterns)).toBeUndefined()
  })

  test("counts in Russian forms", () => {
    const ru = (count: number, word: string) => counted(count, word, "english", "ru")
    expect([1, 2, 5, 11, 21, 22, 112].map((count) => ru(count, "search"))).toEqual([
      "1 поиск",
      "2 поиска",
      "5 поисков",
      "11 поисков",
      "21 поиск",
      "22 поиска",
      "112 поисков",
    ])
    expect(ru(3, "edit")).toBe("english")
    expect(counted(3, "read", "3 reads", "en")).toBe("3 reads")
  })

  test("the Brawl sign-in instructions from the core", () => {
    expect(translate("Check that brawl.io shows KDPR-XWMT and press Connect", ru, patternsOf(ru))).toBe(
      "Проверьте, что brawl.io показывает KDPR-XWMT, и нажмите «Подключить»",
    )
  })
})

describe("the TUI with the Russian dictionary", async () => {
  const root = path.resolve(import.meta.dir, "../../src")
  const files: { name: string; code: string }[] = []
  for await (const name of new Bun.Glob("**/*.{ts,tsx}").scan(root))
    if (!name.startsWith("brawl")) files.push({ name, code: await Bun.file(path.join(root, name)).text() })

  test("every file still parses", () => {
    const transpilers = { ts: new Bun.Transpiler({ loader: "ts" }), tsx: new Bun.Transpiler({ loader: "tsx" }) }
    for (const file of files) {
      const out = localize(file.code, path.join(root, file.name), ru, tuiSpots, "/i18n.ts")
      if (out === file.code) continue
      const transpiler = file.name.endsWith(".tsx") ? transpilers.tsx : transpilers.ts
      expect(() => transpiler.transformSync(out), file.name).not.toThrow()
    }
  })

  test("no phrase of the dictionary is compared", () => {
    const phrases = Object.keys(ru)
      .filter(isPhrase)
      .map((key) => JSON.stringify(key).replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"))
      .join("|")
    const compared = new RegExp(`[=!]==\\s*(${phrases})|(${phrases})\\s*[=!]==|case\\s+(${phrases})`)
    expect(files.filter((file) => compared.test(file.code)).map((file) => file.name)).toEqual([])
  })
})

describe("language", () => {
  test("BRAWL_LANG wins, then the locale variables, then the system's", () => {
    expect(languageOf({ BRAWL_LANG: "en", LANG: "ru_RU.UTF-8" })).toBe("en")
    expect(languageOf({ BRAWL_LANG: "RU" }, "en-US")).toBe("ru")
    expect(languageOf({ LANG: "ru_RU.UTF-8" }, "en-US")).toBe("ru")
    expect(languageOf({ LC_ALL: "C.UTF-8", LANG: "ru_RU.UTF-8" }, "ru-RU")).toBe("en")
    expect(languageOf({}, "ru-RU")).toBe("ru")
    expect(languageOf({}, "en-US")).toBe("en")
    expect(languageOf({ LANG: "rust" }, "")).toBe("en")
  })

  test("every pattern keeps its values", () => {
    for (const [key, value] of Object.entries(ru))
      for (const slot of key.match(/\{\d+\}/g) ?? []) expect(value).toContain(slot)
  })
})
