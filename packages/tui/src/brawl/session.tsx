import { TextAttributes } from "@opentui/core"
import { Show } from "solid-js"
import { useTheme } from "../context/theme"
import type { ResolvedTheme } from "@opencode/theme/tui"
import type { Todo } from "../util/todo"
import { counted, language } from "./i18n"
import { meterCells, sectionTitle } from "./session-text"

export function accent(theme: ResolvedTheme) {
  return theme.background.action.primary.focused
}

export function SectionTitle(props: { theme?: ResolvedTheme; title: string; count?: string }) {
  const theme = props.theme ?? useTheme()
  return (
    <box flexDirection="row" justifyContent="space-between">
      <text fg={theme.text.muted}>{sectionTitle(props.title)}</text>
      <Show when={props.count}>{(count) => <text fg={theme.text.muted}>{count()}</text>}</Show>
    </box>
  )
}

export function Meter(props: { theme?: ResolvedTheme; percent: number; width: number }) {
  const theme = props.theme ?? useTheme()
  const filled = () => meterCells(props.percent, props.width)
  const color = () => (props.percent >= 90 ? theme.text.feedback.error.base : accent(theme))
  return (
    <text wrapMode="none" flexShrink={0}>
      <span style={{ fg: color() }}>{"━".repeat(filled())}</span>
      <span style={{ fg: theme.text.faint }}>{"━".repeat(props.width - filled())}</span>
    </text>
  )
}

export function PlanItem(props: { theme?: ResolvedTheme; todo: Todo }) {
  const theme = props.theme ?? useTheme()
  const marker = () => {
    if (props.todo.status === "completed") return { icon: "✓", fg: theme.text.feedback.success.base }
    if (props.todo.status === "in_progress") return { icon: "◼", fg: accent(theme) }
    if (props.todo.status === "cancelled") return { icon: "–", fg: theme.text.faint }
    return { icon: "◻", fg: theme.text.faint }
  }
  const fg = () => {
    if (props.todo.status === "in_progress") return theme.text.base
    if (props.todo.status === "pending") return theme.text.muted
    return theme.text.faint
  }
  return (
    <box flexDirection="row">
      <text flexShrink={0} width={2} fg={marker().fg}>
        {marker().icon}
      </text>
      <text
        flexGrow={1}
        wrapMode="word"
        fg={fg()}
        attributes={props.todo.status === "cancelled" ? TextAttributes.STRIKETHROUGH : undefined}
      >
        {props.todo.content}
      </text>
    </box>
  )
}

export function ChangeCount(props: { theme?: ResolvedTheme; additions: number; deletions: number }) {
  const theme = props.theme ?? useTheme()
  return (
    <text wrapMode="none" flexShrink={0}>
      <Show when={props.additions > 0 || props.deletions === 0}>
        <span style={{ fg: theme.diff.highlight.added }}>+{props.additions}</span>
      </Show>
      <Show when={props.additions > 0 && props.deletions > 0}> </Show>
      <Show when={props.deletions > 0}>
        <span style={{ fg: theme.diff.highlight.removed }}>−{props.deletions}</span>
      </Show>
    </text>
  )
}

export function changeCountWidth(change: { additions: number; deletions: number }) {
  const added = change.additions > 0 || change.deletions === 0 ? String(change.additions).length + 1 : 0
  const removed = change.deletions > 0 ? String(change.deletions).length + 1 : 0
  return added + removed + (added && removed ? 1 : 0)
}

export function CommandResult(props: { exit: number; duration?: string }) {
  const theme = useTheme()
  return (
    <box flexShrink={0} paddingRight={3}>
      <text wrapMode="none">
        <Show
          when={props.exit === 0}
          fallback={
            <span style={{ fg: theme.text.feedback.error.base }}>
              ✗ {language === "ru" ? "код" : "exit"} {props.exit}
            </span>
          }
        >
          <span style={{ fg: theme.text.feedback.success.base }}>✓</span>
        </Show>
        <Show when={props.duration}>
          <span style={{ fg: theme.text.muted }}>
            {props.exit === 0 ? " " : " · "}
            {props.duration}
          </span>
        </Show>
      </text>
    </box>
  )
}

export const PREVIEW_LINES = 12

export function MoreLines(props: { hidden: number; expanded: boolean; onToggle: () => void }) {
  const theme = useTheme()
  const label = () => {
    if (props.expanded) return language === "ru" ? "свернуть" : "collapse"
    return language === "ru"
      ? `… ещё ${counted(props.hidden, "line", "")} · нажмите, чтобы развернуть`
      : `… ${props.hidden} more line${props.hidden === 1 ? "" : "s"} · click to expand`
  }
  return (
    <Show when={props.hidden > 0}>
      <box paddingLeft={1} onMouseUp={props.onToggle}>
        <text fg={theme.text.muted}>{label()}</text>
      </box>
    </Show>
  )
}
