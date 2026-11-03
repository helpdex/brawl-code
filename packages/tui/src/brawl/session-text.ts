import type { SessionMessageInfo } from "@opencode/client"
import { Brawl } from "@opencode/util/brawl"
import { isRecord } from "../util/record"
import { canonicalToolName } from "../util/tool-display"
import { language, type Language } from "./i18n"

export function compactTokens(value: number, lang: Language = language) {
  const format = (number: number, digits: number) =>
    new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US", { maximumFractionDigits: digits }).format(number)
  if (value < 1000) return format(value, 0)
  if (value < 10_000) return `${format(value / 1000, 1)}K`
  if (value < 1_000_000) return `${format(Math.round(value / 1000), 0)}K`
  return `${format(value / 1_000_000, 1)}M`
}

export function fullNumber(value: number, lang: Language = language) {
  return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US").format(value)
}

export const BRAWL_DEFAULT_WINDOW = 262_144

export function contextWindow(model: { providerID: string; variant?: string }, limit: number | undefined) {
  if (model.providerID !== Brawl.id || model.variant?.toLowerCase() === "1m") return limit
  return Math.min(limit ?? BRAWL_DEFAULT_WINDOW, BRAWL_DEFAULT_WINDOW)
}

export function contextLine(usage: { tokens: number; percent?: number; limit?: number }, lang: Language = language) {
  const tokens = fullNumber(usage.tokens, lang)
  if (!usage.limit) return lang === "ru" ? `${tokens} токенов` : `${tokens} tokens`
  return `${tokens} ${lang === "ru" ? "из" : "of"} ${fullNumber(usage.limit, lang)} · ${usage.percent ?? 0}%`
}

export function contextShort(usage: { tokens: number; limit?: number }, lang: Language = language) {
  const tokens = compactTokens(usage.tokens, lang)
  return usage.limit ? `${tokens} / ${compactTokens(usage.limit, lang)}` : tokens
}

export function meterCells(percent: number, width: number) {
  if (width <= 0 || percent <= 0) return 0
  return Math.min(width, Math.max(1, Math.round((width * percent) / 100)))
}

export function previewLines(text: string, limit: number) {
  const lines = text.replace(/\n$/, "").split("\n")
  if (lines.length <= limit) return { text, hidden: 0 }
  return { text: lines.slice(0, limit).join("\n"), hidden: lines.length - limit }
}

const hunkHeader = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/

export function previewPatch(patch: string, limit: number) {
  const lines = patch.replace(/\n$/, "").split("\n")
  const first = lines.findIndex((line) => hunkHeader.test(line))
  if (first === -1) return { patch, hidden: 0 }
  const body = lines.slice(first).filter((line) => !hunkHeader.test(line) && !line.startsWith("\\")).length
  if (body <= limit) return { patch, hidden: 0 }

  const result = lines.slice(0, first)
  let shown = 0
  let header: { index: number; old: string; next: string; rest: string; before: number; after: number } | undefined
  const close = () => {
    if (!header) return
    result[header.index] = `@@ -${header.old},${header.before} +${header.next},${header.after} @@${header.rest}`
  }
  for (const line of lines.slice(first)) {
    const match = hunkHeader.exec(line)
    if (match) {
      if (shown >= limit) break
      close()
      header = { index: result.length, old: match[1], next: match[2], rest: match[3], before: 0, after: 0 }
      result.push(line)
      continue
    }
    if (line.startsWith("\\")) {
      result.push(line)
      continue
    }
    if (shown >= limit || !header) break
    if (!line.startsWith("+")) header.before++
    if (!line.startsWith("-")) header.after++
    result.push(line)
    shown++
  }
  close()
  return { patch: result.join("\n"), hidden: body - shown }
}

export type FileChange = { path: string; additions: number; deletions: number; added: boolean }

export function sumChanges(changes: Iterable<FileChange>) {
  const files = new Map<string, FileChange>()
  for (const change of changes) {
    const known = files.get(change.path)
    files.set(
      change.path,
      known
        ? {
            path: change.path,
            additions: known.additions + change.additions,
            deletions: known.deletions + change.deletions,
            added: known.added,
          }
        : { ...change },
    )
  }
  return [...files.values()]
}

export function sessionChanges(messages: ReadonlyArray<SessionMessageInfo>, boundary?: string) {
  const end = boundary ? messages.findIndex((message) => message.id === boundary) : -1
  return sumChanges(
    messages
      .slice(0, end === -1 ? messages.length : end)
      .flatMap((message) => (message.type === "assistant" ? message.content : []))
      .flatMap((part): FileChange[] => {
        if (part.type !== "tool" || part.state.status !== "completed") return []
        const name = canonicalToolName(part.name)
        const files = part.state.metadata?.files
        if ((name === "edit" || name === "patch" || name === "write") && Array.isArray(files) && files.length > 0)
          return files.flatMap((item) => {
            if (!isRecord(item)) return []
            const path = typeof item.file === "string" ? item.file : item.relativePath
            if (typeof path !== "string" || typeof item.additions !== "number" || typeof item.deletions !== "number")
              return []
            const added = item.status === "added" || item.type === "add"
            return [{ path, additions: item.additions, deletions: item.deletions, added }]
          })
        const input = part.state.input
        if (name === "write" && typeof input.path === "string" && typeof input.content === "string")
          return [
            {
              path: input.path,
              additions: input.content.replace(/\n$/, "").split("\n").length,
              deletions: 0,
              added: false,
            },
          ]
        return []
      }),
  )
}

export function shortPath(path: string, width: number) {
  if (path.length <= width) return path
  const parts = path.split("/")
  for (let index = 1; index < parts.length; index++) {
    const tail = parts.slice(index).join("/")
    if (tail.length <= width) return tail
  }
  const name = parts.at(-1) ?? path
  return name.length <= width ? name : `…${name.slice(name.length - width + 1)}`
}
