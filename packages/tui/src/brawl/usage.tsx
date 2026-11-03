import type { UsageLimitsBrawl, UsageLimitsBrawlWindow, UsageLimitsInfo } from "@opencode/client"
import { TextAttributes, type RGBA } from "@opentui/core"
import { createEffect, For, Show } from "solid-js"
import { Keymap } from "../context/keymap"
import { useTheme } from "../context/theme"
import { DialogHeader, DialogLayout } from "../ui/dialog"
import { Link } from "../ui/link"
import { useToast } from "../ui/toast"
import { SectionTitle } from "./session"
import { brawlText, fullest, windowLevel } from "./usage-text"

const text = brawlText()

export function DialogBrawlUsage(props: { account: UsageLimitsBrawl }) {
  const theme = useTheme().surface("dialog")
  return (
    <DialogLayout header={<DialogHeader title={text.title} />}>
      <box gap={1}>
        <box>
          <Show when={props.account.email}>
            {(email) => (
              <text fg={theme.text.base} attributes={TextAttributes.BOLD}>
                {email()}
              </text>
            )}
          </Show>
          <text fg={theme.text.muted}>{text.plan(props.account.plan)}</text>
        </box>
        <box>
          <For each={props.account.windows} fallback={<text fg={theme.text.base}>{text.noWindows}</text>}>
            {(window) => (
              <box>
                <text fg={windowColor(window, theme) ?? theme.text.base}>
                  {capitalize(text.window(window))}: {text.used(window)}
                </text>
                <text fg={theme.text.muted}>{capitalize(text.resets(window.resetsAt))}</text>
              </box>
            )}
          </For>
        </box>
        <Show when={text.concurrent(props.account)}>
          {(line) => (
            <text fg={theme.text.muted} wrapMode="word">
              {line()}
            </text>
          )}
        </Show>
        <box>
          <text fg={theme.text.muted}>{text.details}</text>
          <Link href={props.account.usageURL} fg={theme.text.base} />
        </box>
      </box>
    </DialogLayout>
  )
}

export function SidebarBrawlAccount(props: { account: UsageLimitsBrawl }) {
  const theme = useTheme()
  return (
    <box>
      <SectionTitle title="Brawl" />
      <Show when={props.account.email}>
        {(email) => (
          <text fg={theme.text.muted} wrapMode="none">
            <span style={{ fg: theme.text.feedback.success.base }}>● </span>
            {email()}
          </text>
        )}
      </Show>
      <Show when={fullest(props.account)} fallback={<text fg={theme.text.muted}>{text.plan(props.account.plan)}</text>}>
        {(window) => (
          <text fg={windowColor(window(), theme) ?? theme.text.muted}>
            {capitalize(text.window(window()))}: {text.used(window())}
          </text>
        )}
      </Show>
    </box>
  )
}

const warned = new Set<string>()

export function useBrawlAlerts(info: () => UsageLimitsInfo | null | undefined) {
  const toast = useToast()
  const keymap = Keymap.use()
  createEffect(() => {
    const window = fullest(info()?.brawl)
    if (!window) return
    const level = windowLevel(window)
    if (level === "plenty") return
    const key = `${window.id}:${level}:${window.resetsAt}`
    if (warned.has(key)) return
    warned.add(key)
    toast.show({
      title: level === "reached" ? text.reached(window) : text.low(window),
      message: capitalize(text.resets(window.resetsAt)),
      variant: level === "reached" ? "error" : "warning",
      action: { label: text.viewUsage, run: () => keymap.dispatch("usage.show") },
    })
  })
}

function windowColor(
  window: UsageLimitsBrawlWindow,
  theme: { text: { feedback: { error: { base: RGBA }; warning: { base: RGBA } } } },
) {
  const level = windowLevel(window)
  if (level === "reached") return theme.text.feedback.error.base
  if (level === "low") return theme.text.feedback.warning.base
  return undefined
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export { text as brawlUsageText }
