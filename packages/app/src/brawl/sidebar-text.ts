import type { InboxStatus } from "@/shell/titlebar/inbox-model"

export type SidebarText = {
  projects: string
  more: (count: number) => string
  less: string
  empty: string
  status: Record<Exclude<InboxStatus, "ready">, string>
  working: (duration: string) => string
  duration: (seconds: number) => string
  age: (now: number, at: number) => string
}

const ruPlural = (count: number, one: string, few: string, many: string) => {
  const tens = count % 100
  const ones = count % 10

  if (tens >= 11 && tens <= 14) return many

  if (ones === 1) return one

  if (ones >= 2 && ones <= 4) return few

  return many
}

const day = 86_400_000

const daysBetween = (now: number, at: number) => {
  const start = (time: number) => {
    const date = new Date(time)

    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  }

  return Math.round((start(now) - start(at)) / day)
}

const russian: SidebarText = {
  projects: "ПРОЕКТЫ",
  more: (count) => `Ещё ${count}`,
  less: "Свернуть",
  empty: "Сессии появятся здесь",
  status: {
    approval: "ждёт разрешения",
    input: "ждёт ответа",
    working: "работает",
    failed: "ошибка",
    done: "готово",
  },
  working: (duration) => `работает · ${duration}`,
  duration: (seconds) => {
    if (seconds < 60) return `${seconds} с`

    if (seconds < 3600) return `${Math.floor(seconds / 60)} мин`

    return `${Math.floor(seconds / 3600)} ч`
  },
  age: (now, at) => {
    const minutes = Math.max(0, Math.floor((now - at) / 60_000))

    if (minutes < 1) return "только что"

    if (minutes < 60) return `${minutes} ${ruPlural(minutes, "минуту", "минуты", "минут")} назад`
    const days = daysBetween(now, at)

    if (days === 0) return `сегодня, ${new Date(at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}`

    if (days === 1) return "вчера"

    return new Date(at).toLocaleDateString("ru", { day: "numeric", month: "long" })
  },
}

const english: SidebarText = {
  projects: "PROJECTS",
  more: (count) => `${count} more`,
  less: "Show less",
  empty: "Sessions will appear here",
  status: {
    approval: "waiting for approval",
    input: "waiting for an answer",
    working: "working",
    failed: "failed",
    done: "done",
  },
  working: (duration) => `working · ${duration}`,
  duration: (seconds) => {
    if (seconds < 60) return `${seconds}s`

    if (seconds < 3600) return `${Math.floor(seconds / 60)} min`

    return `${Math.floor(seconds / 3600)} h`
  },
  age: (now, at) => {
    const minutes = Math.max(0, Math.floor((now - at) / 60_000))

    if (minutes < 1) return "just now"

    if (minutes < 60) return `${minutes} min ago`
    const days = daysBetween(now, at)

    if (days === 0) return `today, ${new Date(at).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })}`

    if (days === 1) return "yesterday"

    return new Date(at).toLocaleDateString("en", { day: "numeric", month: "long" })
  },
}

export const sidebarText = (locale: string): SidebarText => (locale === "ru" ? russian : english)
