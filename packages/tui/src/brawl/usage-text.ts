import type { UsageLimitsBrawl, UsageLimitsBrawlWindow } from "@opencode/client"
import { formatReset } from "../util/usage-limits"
import { language, type Language } from "./i18n"

export const warnPercent = 80

export function brawlText(lang: Language = language) {
  const ru = lang === "ru"
  return {
    title: ru ? "Использование" : "Usage",
    plan: (plan: string) =>
      plan === "beta" ? (ru ? "Бета · бесплатно" : "Beta · free") : ru ? `Тариф ${plan}` : `Plan ${plan}`,
    concurrent: (account: UsageLimitsBrawl) => {
      const count = account.concurrent
      if (count === undefined) return undefined
      if (!ru) return `${count} ${count === 1 ? "request" : "requests"} at a time, the next one waits its turn`
      return `${count} ${plural(count, ["запрос", "запроса", "запросов"])} одновременно, следующий ждёт очереди`
    },
    noWindows: ru ? "Лимитов на число запросов нет." : "No limits on the number of requests.",
    window: (window: UsageLimitsBrawlWindow) => windowName(window.id, ru),
    used: (window: UsageLimitsBrawlWindow) =>
      ru ? `${Math.round(window.percent)}% использовано` : `${Math.round(window.percent)}% used`,
    resets: (at: number) => (ru ? `сброс ${resetRu(at)}` : `resets ${formatReset(at)}`),
    details: ru ? "Подробно — в кабинете:" : "Details in your dashboard:",
    signIn: ru
      ? "Войдите в Brawl через /connect, чтобы видеть свои лимиты."
      : "Sign in to Brawl with /connect to see your limits.",
    unavailable: ru ? "Brawl сейчас не ответил. Попробуйте позже." : "Brawl did not answer. Try again later.",
    loading: ru ? "Загружаю…" : "Loading…",
    low: (window: UsageLimitsBrawlWindow) =>
      ru
        ? `Brawl: использовано ${Math.round(window.percent)}% лимита «${windowName(window.id, ru)}»`
        : `Brawl: ${Math.round(window.percent)}% of the ${windowName(window.id, ru)} limit used`,
    reached: (window: UsageLimitsBrawlWindow) =>
      ru ? `Brawl: лимит «${windowName(window.id, ru)}» исчерпан` : `Brawl: ${windowName(window.id, ru)} limit reached`,
    viewUsage: ru ? "Открыть" : "View usage",
  }
}

export function fullest(account: UsageLimitsBrawl | undefined) {
  return account?.windows.toSorted((a, b) => Number(b.limited) - Number(a.limited) || b.percent - a.percent)[0]
}

export function windowLevel(window: UsageLimitsBrawlWindow) {
  if (window.limited || window.percent >= 100) return "reached"
  if (window.percent >= warnPercent) return "low"
  return "plenty"
}

function windowName(id: string, ru: boolean) {
  if (id === "5h") return ru ? "5 часов" : "5 hours"
  if (id === "week") return ru ? "неделя" : "week"
  if (id === "month") return ru ? "месяц" : "month"
  return id
}

function plural(count: number, forms: readonly [string, string, string]) {
  const tens = count % 100
  const ones = count % 10
  if (tens >= 11 && tens <= 14) return forms[2]
  if (ones === 1) return forms[0]
  if (ones >= 2 && ones <= 4) return forms[1]
  return forms[2]
}

function resetRu(at: number) {
  const date = new Date(at)
  const time = date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  if (date.toDateString() === new Date().toDateString()) return `сегодня в ${time}`
  return `${date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} в ${time}`
}
