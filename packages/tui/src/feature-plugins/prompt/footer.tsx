import { Plugin } from "@opencode/plugin/tui"
import { createMemo, createSignal, Match, Show, Switch } from "solid-js"
import { contextUsage } from "../../util/session"
import { Meter } from "../../brawl/session"
import { contextShort } from "../../brawl/session-text"

const METER_WIDTH = 12
import { useTerminalDimensions } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import { useInteractivity } from "../../context/interactivity"
import { stringWidth } from "../../util/string-width"
import { createGoal, GoalStatus } from "./goal"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export function PromptFooter(props: {
  context: Plugin.Context
  sessionID?: string
  mode: "normal" | "shell"
  showDetails: boolean
}) {
  const dimensions = useTerminalDimensions()
  const [liveHovered, setLiveHovered] = createSignal(false)
  const subagents = createMemo(() => {
    if (!props.sessionID) return 0
    const count = props.context.data.session
      .family(props.sessionID)
      .filter((id) => id !== props.sessionID && props.context.data.session.status(id) === "running").length
    return count ? `${count} subagent${count === 1 ? "" : "s"}` : undefined
  })
  const shells = createMemo(() => {
    if (!props.sessionID) return 0
    const count = props.context.data.shell
      .list(props.context.location)
      .filter((shell) => shell.metadata.sessionID === props.sessionID).length
    return count ? `${count} shell${count === 1 ? "" : "s"}` : undefined
  })
  const usage = createMemo(() => {
    if (!props.sessionID) return
    const session = props.context.data.session.get(props.sessionID)
    if (!session) return
    return contextUsage(
      props.context.data.session.message.list(props.sessionID),
      props.context.data.location.model.list(session.location),
      session.revert?.messageID,
    )
  })
  const status = createMemo(() => {
    if (!props.sessionID) return []
    const used = usage()
    const cost = props.context.data.session.cost(props.sessionID)
    return [used ? contextShort(used) : undefined, cost > 0 ? money.format(cost) : undefined].filter(
      (item): item is string => Boolean(item),
    )
  })
  const meter = createMemo(() => (usage()?.limit ? METER_WIDTH : 0))
  const live = createMemo(() => Boolean(subagents() || shells()))
  const goal = createGoal(props.context, () => props.sessionID)
  // Prompt hints read as disabled while the session does not own input, e.g. while a side panel is focused.
  const interactive = useInteractivity()
  const shortcut = (id: string) => props.context.keymap.shortcuts(id)[0]
  const layout = createMemo(() => {
    const command = shortcut("command.palette.show")
    if (status().length === 0) return { usage: false, shortcuts: dimensions().width >= 44, meter: false }
    const fit = (bar: number) =>
      promptFooterLayout({
        width: Math.max(0, dimensions().width - 8 - (bar ? bar + 1 : 0)),
        usage: status(),
        shortcuts: command ? [`${command} commands`] : [],
      })
    const full = fit(meter())
    if (meter() && !(full.usage && full.shortcuts)) {
      const plain = fit(0)
      if (plain.usage && plain.shortcuts) return { ...plain, meter: false }
    }
    return { ...full, meter: meter() > 0 && full.usage }
  })

  return (
    <Switch>
      <Match when={props.mode === "normal"}>
        <Switch>
          <Match when={goal() || live() || status().length > 0}>
            <box flexDirection="row" flexShrink={props.showDetails && layout().usage ? 0 : 1} minWidth={0}>
              <Show when={live()}>
                <box
                  flexShrink={0}
                  onMouseOver={() => setLiveHovered(true)}
                  onMouseOut={() => setLiveHovered(false)}
                  onMouseUp={() => props.context.keymap.dispatch("session.child.first")}
                >
                  <text
                    fg={liveHovered() ? props.context.theme.text.base : props.context.theme.text.muted}
                    wrapMode="none"
                  >
                    <Show when={shortcut("session.child.first")}>
                      {(value) => <span style={{ fg: props.context.theme.text.base }}>{value()} </span>}
                    </Show>
                    <Show when={subagents()}>{(value) => <>{value()}</>}</Show>
                    <Show when={subagents() && shells()}> · </Show>
                    <Show when={shells()}>{(value) => <>{value()}</>}</Show>
                  </text>
                </box>
              </Show>
              <Show when={props.sessionID && goal()}>
                <Show when={live()}>
                  <text fg={props.context.theme.text.muted} wrapMode="none" flexShrink={0}>
                    {" · "}
                  </text>
                </Show>
                <GoalStatus context={props.context} sessionID={props.sessionID ?? ""} goal={goal} />
              </Show>
              <Show when={props.showDetails && layout().usage && status().length > 0}>
                <Show when={live() || goal()}>
                  <text fg={props.context.theme.text.muted} wrapMode="none" flexShrink={0}>
                    {" · "}
                  </text>
                </Show>
                <Show when={layout().meter}>
                  <Meter theme={props.context.theme} percent={usage()?.percent ?? 0} width={meter()} />
                  <text flexShrink={0}> </text>
                </Show>
                <text fg={props.context.theme.text.muted} wrapMode="none" flexShrink={0}>
                  {status().join(" · ")}
                </text>
              </Show>
            </box>
          </Match>
          <Match when={props.showDetails && layout().shortcuts}>
            <text
              fg={interactive() ? props.context.theme.text.base : props.context.theme.text.action.primary.disabled}
              attributes={interactive() ? 0 : TextAttributes.DIM}
              flexShrink={0}
            >
              {shortcut("agent.cycle")}{" "}
              <span style={interactive() ? { fg: props.context.theme.text.muted } : {}}>agents</span>
            </text>
          </Match>
        </Switch>
        <Show when={props.showDetails && layout().shortcuts}>
          <text
            fg={interactive() ? props.context.theme.text.base : props.context.theme.text.action.primary.disabled}
            attributes={interactive() ? 0 : TextAttributes.DIM}
            wrapMode="none"
            flexShrink={0}
          >
            {shortcut("command.palette.show")}{" "}
            <span style={interactive() ? { fg: props.context.theme.text.muted } : {}}>commands</span>
          </text>
        </Show>
      </Match>
      <Match when={props.mode === "shell"}>
        <text fg={props.context.theme.text.base} flexShrink={0}>
          esc{" "}
          <span style={{ fg: props.context.theme.text.muted }}>
            {dimensions().width < 44 ? "shell" : "exit shell mode"}
          </span>
        </text>
      </Match>
    </Switch>
  )
}

export default Plugin.define({
  id: "opencode.prompt.footer",
  setup(context) {
    context.ui.slot({
      append: "prompt.footer",
      render: (props) => (
        <PromptFooter context={context} sessionID={props.sessionID} mode={props.mode} showDetails={props.showDetails} />
      ),
    })
  },
})

function promptFooterLayout(input: { width: number; usage: string[]; shortcuts: string[] }) {
  const usage = input.usage.join(" · ")
  const shortcuts = input.shortcuts.join(" · ")
  const available = Math.max(0, input.width - Math.min(28, Math.floor(input.width / 2)))
  if (usage && shortcuts && stringWidth(`${usage} · ${shortcuts}`) <= available) {
    return { usage: true, shortcuts: true }
  }
  if (usage && stringWidth(usage) <= available) return { usage: true, shortcuts: false }
  if (!usage && shortcuts && stringWidth(shortcuts) <= available) return { usage: false, shortcuts: true }
  return { usage: false, shortcuts: false }
}
