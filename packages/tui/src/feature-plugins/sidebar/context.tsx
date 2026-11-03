import { Plugin } from "@opencode/plugin/tui"
import { createMemo, Show } from "solid-js"
import { contextUsage } from "../../util/session"
import { Meter, SectionTitle } from "../../brawl/session"
import { contextLine } from "../../brawl/session-text"
import { SESSION_SIDEBAR_WIDTH } from "../../ui/layout"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export function SidebarContext(props: { context: Plugin.Context; sessionID: string }) {
  const theme = props.context.theme
  const msg = createMemo(() => props.context.data.session.message.list(props.sessionID))
  const session = createMemo(() => props.context.data.session.get(props.sessionID))
  const cost = createMemo(() => props.context.data.session.cost(props.sessionID))

  const state = createMemo(() =>
    contextUsage(msg(), props.context.data.location.model.list(session()?.location), session()?.revert?.messageID),
  )

  return (
    <Show when={state() || cost() > 0}>
      <box>
        <SectionTitle theme={theme} title="Context" />
        <Show when={state()}>
          {(value) => (
            <>
              <Show when={value().limit}>
                <Meter theme={theme} percent={value().percent ?? 0} width={SESSION_SIDEBAR_WIDTH - 6} />
              </Show>
              <text fg={theme.text.muted}>{contextLine(value())}</text>
            </>
          )}
        </Show>
        <Show when={cost() > 0}>
          <text fg={theme.text.muted}>{money.format(cost())} spent</text>
        </Show>
      </box>
    </Show>
  )
}

export default Plugin.define({
  id: "opencode.sidebar.context",
  setup(context) {
    context.ui.slot({
      append: "sidebar.content",
      render: (props) => <SidebarContext context={context} sessionID={props.sessionID} />,
    })
  },
})
