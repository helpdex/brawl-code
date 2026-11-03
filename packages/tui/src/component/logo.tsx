import { RGBA, TextAttributes } from "@opentui/core"
import { Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "../context/theme"

const ink = RGBA.fromHex("#0b0b0d")

export function Logo() {
  const theme = useTheme()
  const dimensions = useTerminalDimensions()

  const mark = () => (
    <text fg={ink} bg={theme.hue.accent[200]} attributes={TextAttributes.BOLD} selectable={false}>
      {" // "}
    </text>
  )

  return (
    <Show when={dimensions().height >= 12}>
      <box>
        <box flexDirection="row" gap={2}>
          {mark()}
          <text fg={theme.text.base} attributes={TextAttributes.BOLD} selectable={false}>
            Brawl Code
          </text>
        </box>
        <box flexDirection="row" gap={2}>
          {mark()}
          <Show when={dimensions().width >= 50}>
            <text fg={theme.text.muted} selectable={false}>
              Coding agent on Brawl's own model
            </text>
          </Show>
        </box>
      </box>
    </Show>
  )
}
