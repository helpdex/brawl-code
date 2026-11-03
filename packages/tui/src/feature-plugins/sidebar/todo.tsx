import { Plugin } from "@opencode/plugin/tui"
import { createMemo, For, Show } from "solid-js"
import { PlanItem, SectionTitle } from "../../brawl/session"
import { sessionTodos } from "../../util/todo"

export function SidebarTodo(props: { context: Plugin.Context; sessionID: string }) {
  const [view, updateView] = props.context.storage.store("view", { initial: { open: true } })
  const theme = props.context.theme
  const list = createMemo(() =>
    sessionTodos(
      props.context.data.session.message.list(props.sessionID),
      props.context.data.session.get(props.sessionID)?.revert?.messageID,
    ),
  )
  const remaining = createMemo(
    () => list().filter((item) => item.status === "pending" || item.status === "in_progress").length,
  )

  return (
    <Show when={list().length > 0}>
      <box>
        <box
          flexDirection="row"
          gap={1}
          onMouseDown={() => {
            if (list().length <= 2) return
            void updateView((draft) => {
              draft.open = !draft.open
            }).catch((error) => console.error("Failed to persist todo sidebar state", error))
          }}
        >
          <Show when={list().length > 2}>
            <text fg={theme.text.muted}>{view.open ? "▾" : "▸"}</text>
          </Show>
          <box flexGrow={1}>
            <SectionTitle theme={theme} title="Plan" count={`${list().length - remaining()}/${list().length}`} />
          </box>
        </box>
        <Show when={list().length <= 2 || view.open}>
          <For each={list()}>{(item) => <PlanItem theme={theme} todo={item} />}</For>
        </Show>
      </box>
    </Show>
  )
}

export default Plugin.define({
  id: "opencode.sidebar.todo",
  setup(context) {
    context.ui.slot({
      append: "sidebar.content",
      render: (props) => <SidebarTodo context={context} sessionID={props.sessionID} />,
    })
  },
})
