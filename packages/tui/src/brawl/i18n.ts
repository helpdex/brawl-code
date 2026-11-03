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

export function t(text: string) {
  return (language === "ru" && ru[text]) || text
}

export function tf(pattern: string, ...values: unknown[]) {
  const text = (language === "ru" && ru[pattern]) || pattern
  return text.replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)]))
}
