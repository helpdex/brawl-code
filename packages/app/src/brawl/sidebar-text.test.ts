import { describe, expect, test } from "bun:test"
import { sidebarText } from "./sidebar-text"

const at = new Date(2026, 10, 4, 15, 30).getTime()

const minutes = (count: number) => at - count * 60_000

describe("sidebarText", () => {
  test("Russian ages agree with the number", () => {
    const text = sidebarText("ru")
    expect(text.age(at, at)).toBe("только что")
    expect(text.age(at, minutes(1))).toBe("1 минуту назад")
    expect(text.age(at, minutes(3))).toBe("3 минуты назад")
    expect(text.age(at, minutes(11))).toBe("11 минут назад")
    expect(text.age(at, minutes(21))).toBe("21 минуту назад")
  })

  test("yesterday is the calendar day, not 24 hours", () => {
    const text = sidebarText("ru")
    expect(text.age(new Date(2026, 10, 4, 0, 30).getTime(), new Date(2026, 10, 3, 23, 0).getTime())).toBe("вчера")
    expect(text.age(at, new Date(2026, 10, 2, 12, 0).getTime())).toBe("2 ноября")
    expect(sidebarText("en").age(at, new Date(2026, 10, 3, 9, 0).getTime())).toBe("yesterday")
  })

  test("working shows how long the run has gone", () => {
    const text = sidebarText("ru")
    expect(text.working(text.duration(42))).toBe("работает · 42 с")
    expect(text.working(text.duration(4 * 60 + 5))).toBe("работает · 4 мин")
    expect(sidebarText("de").working(sidebarText("de").duration(2 * 3600))).toBe("working · 2 h")
  })

  test("the account footer names the plan and the generations against the limit", () => {
    expect(sidebarText("ru").plan("beta")).toBe("Бета · бесплатно")
    expect(sidebarText("ru").streams(1, 1)).toBe("1 из 1 потока")
    expect(sidebarText("ru").streams(0, 3)).toBe("0 из 3 потоков")
    expect(sidebarText("en").plan("beta")).toBe("Beta · free")
    expect(sidebarText("en").streams(1, 2)).toBe("1 of 2 streams")
    expect(sidebarText("en").plan("pro")).toBe("Pro")
  })
})
