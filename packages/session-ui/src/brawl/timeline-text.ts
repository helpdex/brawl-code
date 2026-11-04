export type Language = "en" | "ru"

export function language(locale: string): Language {
  return locale.toLowerCase().split("-")[0] === "ru" ? "ru" : "en"
}

type Kind = "read" | "search" | "web" | "fetch" | "docs" | "plan" | "other"

const kinds = new Map<string, Kind>([
  ["read", "read"],
  ["list", "search"],
  ["glob", "search"],
  ["grep", "search"],
  ["codesearch", "search"],
  ["websearch", "web"],
  ["webfetch", "fetch"],
  ["docs", "docs"],
  ["todowrite", "plan"],
])

const exploring = new Set<Kind>(["read", "search", "web", "fetch", "docs"])

function ruPlural(count: number, one: string, few: string, many: string) {
  const tens = count % 100
  const units = count % 10

  if (tens >= 11 && tens <= 14) return many

  if (units === 1) return one

  if (units >= 2 && units <= 4) return few

  return many
}

const phrases: Readonly<Record<Language, Readonly<Record<Kind, (count: number) => string>>>> = {
  en: {
    read: (n) => `read ${n} ${n === 1 ? "file" : "files"}`,
    search: (n) => `searched ${n === 1 ? "once" : `${n} times`}`,
    web: (n) => `searched the web ${n === 1 ? "once" : `${n} times`}`,
    fetch: (n) => `opened ${n} ${n === 1 ? "page" : "pages"}`,
    docs: (n) => `checked the docs ${n === 1 ? "once" : `${n} times`}`,
    plan: () => "updated the plan",
    other: (n) => `${n} more ${n === 1 ? "step" : "steps"}`,
  },
  ru: {
    read: (n) => `прочитал ${n} ${ruPlural(n, "файл", "файла", "файлов")}`,
    search: (n) => `искал ${n} ${ruPlural(n, "раз", "раза", "раз")}`,
    web: (n) => `искал в вебе ${n} ${ruPlural(n, "раз", "раза", "раз")}`,
    fetch: (n) => `открыл ${n} ${ruPlural(n, "страницу", "страницы", "страниц")}`,
    docs: (n) => `смотрел документацию ${n} ${ruPlural(n, "раз", "раза", "раз")}`,
    plan: () => "обновил план",
    other: (n) => `ещё ${n} ${ruPlural(n, "шаг", "шага", "шагов")}`,
  },
}

const titles: Readonly<Record<Language, { done: string; pending: string }>> = {
  en: { done: "Explored the project", pending: "Exploring the project" },
  ru: { done: "Изучил проект", pending: "Изучаю проект" },
}

export function exploreSummary(names: readonly string[], pending: boolean, lang: Language) {
  const counts = new Map<Kind, number>()

  for (const name of names) {
    const kind = kinds.get(name) ?? "other"
    counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }

  if (![...counts.keys()].some((kind) => exploring.has(kind))) return undefined
  const order: Kind[] = ["read", "search", "web", "fetch", "docs", "plan", "other"]

  return {
    title: pending ? titles[lang].pending : titles[lang].done,
    details: order.flatMap((kind) => {
      const count = counts.get(kind)

      return count ? [phrases[lang][kind](count)] : []
    }),
  }
}

export function shortDuration(ms: number, lang: Language) {
  const seconds = ms / 1000

  if (seconds < 60) {
    const value = new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(seconds)

    return lang === "ru" ? `${value} с` : `${value}s`
  }

  const total = Math.round(seconds)
  const rest = String(total % 60).padStart(2, "0")

  return lang === "ru" ? `${Math.floor(total / 60)} мин ${rest} с` : `${Math.floor(total / 60)}m ${rest}s`
}

export function toolDuration(time: { created: number; ran?: number; completed?: number }) {
  return time.completed === undefined ? undefined : Math.max(0, time.completed - (time.ran ?? time.created))
}

export function commandResult(exit: number, duration: number | undefined, lang: Language) {
  const time = duration === undefined ? undefined : shortDuration(duration, lang)

  if (exit === 0) return { ok: true, text: time ?? (lang === "ru" ? "готово" : "done") }
  const code = lang === "ru" ? `код ${exit}` : `exit ${exit}`

  return { ok: false, text: time ? `${code} · ${time}` : code }
}

export const text = {
  en: { more: (n: number) => `${n} more ${n === 1 ? "line" : "lines"}`, less: "Show less", added: "new" },
  ru: {
    more: (n: number) => `ещё ${n} ${ruPlural(n, "строка", "строки", "строк")}`,
    less: "Свернуть",
    added: "новый",
  },
} satisfies Record<Language, { more: (n: number) => string; less: string; added: string }>
