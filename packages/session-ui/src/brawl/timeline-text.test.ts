import { describe, expect, test } from "bun:test"
import { commandResult, exploreSummary, language, shortDuration, text, toolDuration } from "./timeline-text"

describe("exploreSummary", () => {
  test("counts what the group did, in a fixed order", () => {
    expect(exploreSummary(["grep", "read", "read", "glob", "docs", "read"], false, "ru")).toEqual({
      title: "Изучил проект",
      details: ["прочитал 3 файла", "искал 2 раза", "смотрел документацию 1 раз"],
    })
    expect(exploreSummary(["read", "websearch", "webfetch", "webfetch", "todowrite", "skill"], true, "en")).toEqual({
      title: "Exploring the project",
      details: ["read 1 file", "searched the web once", "opened 2 pages", "updated the plan", "1 more step"],
    })
  })

  test("Russian plurals", () => {
    const reads = (count: number) => exploreSummary(Array(count).fill("read"), false, "ru")?.details[0]
    expect([1, 2, 5, 11, 21, 22, 25, 111].map(reads)).toEqual([
      "прочитал 1 файл",
      "прочитал 2 файла",
      "прочитал 5 файлов",
      "прочитал 11 файлов",
      "прочитал 21 файл",
      "прочитал 22 файла",
      "прочитал 25 файлов",
      "прочитал 111 файлов",
    ])
  })

  test("leaves groups that did not explore to the caller", () => {
    expect(exploreSummary(["todowrite", "skill"], false, "ru")).toBeUndefined()
    expect(exploreSummary([], false, "en")).toBeUndefined()
  })
})

describe("command result", () => {
  test("success shows the time, failure the exit code first", () => {
    expect(commandResult(0, 3100, "ru")).toEqual({ ok: true, text: "3,1 с" })
    expect(commandResult(1, 3100, "en")).toEqual({ ok: false, text: "exit 1 · 3.1s" })
    expect(commandResult(2, undefined, "ru")).toEqual({ ok: false, text: "код 2" })
    expect(commandResult(0, undefined, "en")).toEqual({ ok: true, text: "done" })
  })

  test("durations", () => {
    expect(shortDuration(400, "en")).toBe("0.4s")
    expect(shortDuration(65_000, "ru")).toBe("1 мин 05 с")
    expect(toolDuration({ created: 1000, ran: 1500, completed: 4600 })).toBe(3100)
    expect(toolDuration({ created: 1000, completed: 2000 })).toBe(1000)
    expect(toolDuration({ created: 1000 })).toBeUndefined()
  })
})

test("language and line counts", () => {
  expect(language("ru-RU")).toBe("ru")
  expect(language("de")).toBe("en")
  expect(text.ru.more(52)).toBe("ещё 52 строки")
  expect(text.ru.more(5)).toBe("ещё 5 строк")
  expect(text.en.more(1)).toBe("1 more line")
})
