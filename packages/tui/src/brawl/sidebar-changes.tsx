import { Plugin } from "@opencode/plugin/tui"
import { createMemo, For, Show } from "solid-js"
import { SESSION_SIDEBAR_WIDTH } from "../ui/layout"
import { ChangeCount, SectionTitle } from "./session"
import { sessionChanges, shortPath } from "./session-text"

const shown = 8

export function SidebarChanges(props: { context: Plugin.Context; sessionID: string }) {
  const theme = props.context.theme
  const files = createMemo(() =>
    sessionChanges(
      props.context.data.session.message.list(props.sessionID),
      props.context.data.session.get(props.sessionID)?.revert?.messageID,
    ),
  )
  return (
    <Show when={files().length > 0}>
      <box>
        <SectionTitle theme={theme} title="Changes" count={String(files().length)} />
        <For each={files().slice(0, shown)}>
          {(file) => (
            <box flexDirection="row" justifyContent="space-between" gap={1}>
              <text fg={theme.text.muted} wrapMode="none">
                {shortPath(file.path, SESSION_SIDEBAR_WIDTH - 16)}
              </text>
              <ChangeCount theme={theme} additions={file.additions} deletions={file.deletions} />
            </box>
          )}
        </For>
        <Show when={files().length > shown}>
          <text fg={theme.text.faint}>… +{files().length - shown}</text>
        </Show>
      </box>
    </Show>
  )
}

export default Plugin.define({
  id: "brawl.sidebar.changes",
  setup(context) {
    context.ui.slot({
      append: "sidebar.content",
      render: (props) => <SidebarChanges context={context} sessionID={props.sessionID} />,
    })
  },
})
