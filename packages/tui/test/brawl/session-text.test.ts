import { describe, expect, test } from "bun:test"
import {
  compactTokens,
  contextLine,
  contextShort,
  contextWindow,
  fullNumber,
  meterCells,
  previewLines,
  previewPatch,
  shortPath,
  sumChanges,
} from "../../src/brawl/session-text"

const patch = [
  "Index: a.py",
  "===================================================================",
  "--- a.py",
  "+++ a.py",
  "@@ -1,3 +1,4 @@",
  " one",
  "-two",
  "+TWO",
  "+three",
  " four",
  "@@ -10,2 +11,2 @@",
  " ten",
  "-eleven",
  "+ELEVEN",
].join("\n")

describe("Brawl session text", () => {
  test("tokens in a few characters", () => {
    expect(compactTokens(950, "en")).toBe("950")
    expect(compactTokens(8674, "en")).toBe("8.7K")
    expect(compactTokens(8674, "ru")).toBe("8,7K")
    expect(compactTokens(38_412, "en")).toBe("38K")
    expect(compactTokens(262_144, "en")).toBe("262K")
    expect(compactTokens(1_048_576, "en")).toBe("1M")
    expect(fullNumber(262_144, "en")).toBe("262,144")
    expect(fullNumber(262_144, "ru")).toBe("262\u00a0144")
  })

  test("context use in words and in short", () => {
    expect(contextLine({ tokens: 38_412, percent: 15, limit: 262_144 }, "en")).toBe("38,412 of 262,144 · 15%")
    expect(contextLine({ tokens: 38_412, percent: 15, limit: 262_144 }, "ru")).toBe("38\u00a0412 из 262\u00a0144 · 15%")
    expect(contextLine({ tokens: 950 }, "en")).toBe("950 tokens")
    expect(contextShort({ tokens: 38_412, limit: 262_144 }, "en")).toBe("38K / 262K")
    expect(contextShort({ tokens: 8_674 }, "en")).toBe("8.7K")
  })

  test("Brawl's window follows the variant", () => {
    expect(contextWindow({ providerID: "brawl" }, 1_048_576)).toBe(262_144)
    expect(contextWindow({ providerID: "brawl", variant: "1M" }, 1_048_576)).toBe(1_048_576)
    expect(contextWindow({ providerID: "brawl" }, undefined)).toBe(262_144)
    expect(contextWindow({ providerID: "anthropic" }, 200_000)).toBe(200_000)
    expect(contextWindow({ providerID: "brawl", id: "brawl-code-free" }, 1_048_576)).toBe(1_048_576)
  })

  test("a meter shows any use and never overflows", () => {
    expect(meterCells(0, 20)).toBe(0)
    expect(meterCells(1, 20)).toBe(1)
    expect(meterCells(15, 20)).toBe(3)
    expect(meterCells(140, 20)).toBe(20)
  })

  test("a preview of text", () => {
    expect(previewLines("a\nb\nc\n", 5)).toEqual({ text: "a\nb\nc\n", hidden: 0 })
    expect(previewLines("a\nb\nc\nd", 2)).toEqual({ text: "a\nb", hidden: 2 })
  })

  test("a patch preview keeps valid hunk headers", () => {
    expect(previewPatch(patch, 20)).toEqual({ patch, hidden: 0 })
    const cut = previewPatch(patch, 3)
    expect(cut.hidden).toBe(5)
    expect(cut.patch.split("\n").slice(4)).toEqual(["@@ -1,2 +1,2 @@", " one", "-two", "+TWO"])
    const second = previewPatch(patch, 6)
    expect(second.hidden).toBe(2)
    expect(second.patch.split("\n").slice(4)).toEqual([
      "@@ -1,3 +1,4 @@",
      " one",
      "-two",
      "+TWO",
      "+three",
      " four",
      "@@ -10,1 +11,1 @@",
      " ten",
    ])
  })

  test("changes add up per file", () => {
    expect(
      sumChanges([
        { path: "a.py", additions: 3, deletions: 1, added: true },
        { path: "b.py", additions: 1, deletions: 0, added: false },
        { path: "a.py", additions: 2, deletions: 2, added: false },
      ]),
    ).toEqual([
      { path: "a.py", additions: 5, deletions: 3, added: true },
      { path: "b.py", additions: 1, deletions: 0, added: false },
    ])
  })

  test("a short path ends at a folder", () => {
    expect(shortPath("lib/shop/payments/yookassa.ex", 40)).toBe("lib/shop/payments/yookassa.ex")
    expect(shortPath("lib/shop/payments/yookassa.ex", 20)).toBe("payments/yookassa.ex")
    expect(shortPath("lib/a_very_long_file_name.ex", 10)).toBe("…e_name.ex")
  })
})
