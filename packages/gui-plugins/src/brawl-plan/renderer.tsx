import { createMemo, For, Show } from "solid-js"
import { Icon } from "@opencode/ui/icon"
import { Style, type MountedSession, type Plugin } from "@opencode/plugin/gui"
import { BuiltinPanel, type BuiltinPanelTab } from "@opencode/plugin/gui/builtin"
import type definition from "./index"
import { currentIndex, finishedCount, planTodos, type Todo } from "./plan"
import { planText, type PlanText } from "./text"
import styles from "./plan.css?inline"

const empty: Todo[] = []

const sessionPlan = (session: MountedSession) => {
  const id = session.id

  if (!id) return empty

  const data = session.server.data

  return planTodos(data.session.message.list(id), data.session.get(id)?.revert?.messageID)
}

const setup: Plugin.Setup<typeof definition> = (ctx) => {
  ctx.add(Style, styles)
  const layout = ctx.layout
  const text = createMemo(() => planText(ctx.locale.locale()))

  const tab: BuiltinPanelTab = {
    id: "main",
    get title() {
      return text().tab
    },
    pinned: true,
    tabbable: true,
    label: (state) => {
      const todos = createMemo(() => sessionPlan(state.session))

      return (
        <div class="flex items-center gap-1.5">
          <Icon name="checklist" size="small" />
          <span>{text().tab}</span>
          <span data-slot="brawl-plan-count">
            {finishedCount(todos())}/{todos().length}
          </span>
        </div>
      )
    },
    dom: { tab: "session-side-panel-plan-tab", panel: "session-side-panel-plan-tabpanel" },
  }

  ctx.add(BuiltinPanel, {
    id: "main",
    region: "side",
    list: (input) => (!layout.narrow() && sessionPlan(input.session).length > 0 ? [tab] : []),
    render: (props) => <PlanView todos={sessionPlan(props.session)} text={text()} />,
  })
}

function PlanView(props: { todos: readonly Todo[]; text: PlanText }) {
  const done = () => finishedCount(props.todos)
  const current = () => currentIndex(props.todos)

  return (
    <div data-component="brawl-plan">
      <div data-slot="brawl-plan-header">
        <div data-slot="brawl-plan-title">
          <span>{props.text.title}</span>
          <span data-slot="brawl-plan-progress">{props.text.progress(done(), props.todos.length)}</span>
        </div>
        <div data-slot="brawl-plan-meter">
          <i style={{ width: `${props.todos.length ? (done() / props.todos.length) * 100 : 0}%` }} />
        </div>
      </div>
      <ol data-slot="brawl-plan-items">
        <For each={props.todos}>
          {(todo, index) => (
            <li data-slot="brawl-plan-item" data-status={todo.status} data-current={index() === current() || undefined}>
              <span data-slot="brawl-plan-mark">
                <Show when={todo.status === "completed"}>
                  <Icon name="check" size="small" />
                </Show>
              </span>
              <span data-slot="brawl-plan-text">{todo.content}</span>
              <Show when={index() === current()}>
                <span data-slot="brawl-plan-now">
                  {todo.status === "in_progress" ? props.text.working : props.text.next}
                </span>
              </Show>
            </li>
          )}
        </For>
      </ol>
      <p data-slot="brawl-plan-note">{props.text.note}</p>
    </div>
  )
}

export default setup
