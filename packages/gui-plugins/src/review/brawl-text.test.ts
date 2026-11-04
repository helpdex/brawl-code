import { describe, expect, test } from "bun:test"
import { reviewText } from "./brawl-text"

describe("reviewText", () => {
  test("Russian counts files with the right forms", () => {
    const text = reviewText("ru")
    expect(text.revertButton(1)).toBe("Откатить 1 файл")
    expect(text.revertButton(3)).toBe("Откатить 3 файла")
    expect(text.revertButton(11)).toBe("Откатить 11 файлов")
    expect(text.revertGit(21)).toStartWith("21 файл вернётся к последнему коммиту")
    expect(text.revertTurn(2)).toStartWith("2 файла вернутся к состоянию до последнего ответа агента")
    expect(text.committed("a1b2c3d", "main")).toBe("Коммит a1b2c3d в main")
  })

  test("other languages read English", () => {
    expect(reviewText("ru-RU").revertAll).toBe("Откатить всё")
    expect(reviewText("de").revertButton(1)).toBe("Revert 1 file")
    expect(reviewText("en").revertTurn(2)).toContain("how they were before the agent's last reply")
  })
})
