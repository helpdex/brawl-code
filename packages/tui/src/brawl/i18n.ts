import { ru } from "./ru"

export type Language = "en" | "ru"

export function languageOf(env: Record<string, string | undefined>, system = systemLocale()): Language {
  const chosen = env.BRAWL_LANG?.toLowerCase()
  if (chosen === "ru" || chosen === "en") return chosen
  const locale = env.LC_ALL || env.LC_MESSAGES || env.LANG || system
  return /^ru(?:[_.-]|$)/i.test(locale) ? "ru" : "en"
}

function systemLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale
  } catch {
    return ""
  }
}

export const language = languageOf(process.env)

export function patternsOf(dictionary: Readonly<Record<string, string>>) {
  return Object.entries(dictionary)
    .filter(([key]) => /\{\d+\}/.test(key))
    .map(([key, value]) => {
      const order: number[] = []
      const source = key
        .split(/\{(\d+)\}/)
        .map((part, index) => {
          if (index % 2 === 0) return part.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
          order.push(Number(part))
          return "(.+?)"
        })
        .join("")
      return { match: new RegExp(`^${source}$`, "s"), order, value }
    })
}

type Patterns = ReturnType<typeof patternsOf>

export function translate(text: string, dictionary: Readonly<Record<string, string>>, patterns: Patterns): string
export function translate(
  text: string | undefined,
  dictionary: Readonly<Record<string, string>>,
  patterns: Patterns,
): string | undefined
export function translate(text: string | undefined, dictionary: Readonly<Record<string, string>>, patterns: Patterns) {
  if (typeof text !== "string") return text
  if (dictionary[text]) return dictionary[text]
  for (const pattern of patterns) {
    const found = pattern.match.exec(text)
    if (!found) continue
    const values: string[] = []
    pattern.order.forEach((slot, index) => (values[slot] = found[index + 1]))
    return pattern.value.replace(/\{(\d+)\}/g, (_, slot: string) => values[Number(slot)] ?? "")
  }
  return text
}

const patterns = language === "ru" ? patternsOf(ru) : []

export function t(text: string): string
export function t(text: string | undefined): string | undefined
export function t(text: string | undefined) {
  return language === "ru" ? translate(text, ru, patterns) : text
}

const forms: Readonly<Record<string, readonly [string, string, string]>> = {
  read: ["чтение", "чтения", "чтений"],
  search: ["поиск", "поиска", "поисков"],
  fetch: ["загрузка", "загрузки", "загрузок"],
  step: ["шаг", "шага", "шагов"],
}

export function counted(count: number, word: string, english: string, lang = language) {
  const form = forms[word]
  if (lang !== "ru" || !form) return english
  const tens = count % 100
  const ones = count % 10
  const index = tens >= 11 && tens <= 14 ? 2 : ones === 1 ? 0 : ones >= 2 && ones <= 4 ? 1 : 2
  return `${count} ${form[index]}`
}

export function tf(pattern: string, ...values: unknown[]) {
  const text = (language === "ru" && ru[pattern]) || pattern
  return text.replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)]))
}
