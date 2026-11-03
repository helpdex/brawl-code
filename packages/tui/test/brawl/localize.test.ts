import { describe, expect, test } from "bun:test"
import { languageOf } from "../../src/brawl/i18n"
import { localize } from "../../src/brawl/localize"
import { ru } from "../../src/brawl/ru"

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
    expect(run(`const x = { provider: "Connect a provider" }`)).toBe(`const x = { provider: "Connect a provider" }`)
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
