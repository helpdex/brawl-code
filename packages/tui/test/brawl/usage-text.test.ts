import { describe, expect, test } from "bun:test"
import { brawlText, fullest, windowLevel } from "../../src/brawl/usage-text"

const at = Date.parse("2030-01-02T15:30:00")
const window = (id: string, percent: number, limited = false) => ({ id, percent, limited, resetsAt: at })
const beta = { email: "anna@example.com", plan: "beta", windows: [], usageURL: "https://brawl.io/app/usage" }

describe("Brawl usage text", () => {
  test("the beta plan and the queue in both languages", () => {
    const ru = brawlText("ru")
    const en = brawlText("en")
    expect(ru.plan("beta")).toBe("Бета · бесплатно")
    expect(en.plan("pro")).toBe("Plan pro")
    expect(ru.concurrent({ ...beta, concurrent: 1 })).toBe("1 запрос одновременно, следующий ждёт очереди")
    expect(ru.concurrent({ ...beta, concurrent: 3 })).toBe("3 запроса одновременно, следующий ждёт очереди")
    expect(ru.concurrent({ ...beta, concurrent: 12 })).toBe("12 запросов одновременно, следующий ждёт очереди")
    expect(en.concurrent({ ...beta, concurrent: 1 })).toBe("1 request at a time, the next one waits its turn")
    expect(en.concurrent(beta)).toBeUndefined()
  })

  test("a window, its use and when it resets", () => {
    const ru = brawlText("ru")
    expect(ru.window(window("5h", 42))).toBe("5 часов")
    expect(ru.used(window("week", 41.6))).toBe("42% использовано")
    expect(ru.resets(at)).toBe("сброс 2 января в 15:30")
    expect(ru.reached(window("week", 100, true))).toBe("Brawl: лимит «неделя» исчерпан")
    expect(brawlText("en").low(window("5h", 85))).toBe("Brawl: 85% of the 5 hours limit used")
    expect(brawlText("en").window(window("day", 1))).toBe("day")
  })

  test("the fullest window sets the warning, a refused one first", () => {
    expect(fullest(beta)).toBeUndefined()
    expect(fullest({ ...beta, windows: [window("5h", 30), window("week", 85)] })?.id).toBe("week")
    expect(fullest({ ...beta, windows: [window("5h", 100, true), window("week", 99)] })?.id).toBe("5h")
    expect(windowLevel(window("5h", 79))).toBe("plenty")
    expect(windowLevel(window("5h", 80))).toBe("low")
    expect(windowLevel(window("5h", 20, true))).toBe("reached")
  })
})
