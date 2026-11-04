import { createEffect, createMemo, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Menu } from "@opencode/ui/menu"
import { displayName } from "@opencode/ui/project-avatar"
import { useLanguage } from "@/runtime/i18n/language"
import { SessionTabAvatarView } from "@/shell/layout/session-tab-avatar"
import { sessionTabTitle } from "@/shell/titlebar/tab-title"
import { createSessionInbox, type InboxEntry, type InboxStatus } from "@/shell/titlebar/inbox-model"
import { workingSince } from "@/shell/titlebar/inbox-working"
import { sidebarText } from "./sidebar-text"
import { BrawlSidebarAccount } from "./sidebar-account"

const SHOWN = 5

type Group = { key: string; entries: InboxEntry[] }

const active = (status: InboxStatus) => status === "working" || status === "approval" || status === "input"

const projectKey = (entry: InboxEntry) =>
  `${entry.server}\n${entry.ctx.projects.forSession(entry.session)?.worktree ?? entry.session.location.directory}`

export function BrawlSidebar() {
  const language = useLanguage()
  const text = createMemo(() => sidebarText(language.locale()))
  const inbox = createSessionInbox()

  const [state, setState] = createStore<{ collapsed: Record<string, boolean>; expanded: Record<string, boolean> }>({
    collapsed: {},
    expanded: {},
  })

  const groups = createMemo(() => {
    const map = new Map<string, Group>()

    for (const entry of inbox.entries()) {
      const key = projectKey(entry)
      const group = map.get(key) ?? { key, entries: [] }
      group.entries.push(entry)
      map.set(key, group)
    }

    const updated = (entry: InboxEntry) => entry.session.time.updated

    const list = [...map.values()].map((group) => ({
      ...group,
      entries: group.entries.toSorted(
        (a, b) => Number(active(b.status)) - Number(active(a.status)) || updated(b) - updated(a),
      ),
    }))

    return list.toSorted((a, b) => Math.max(...b.entries.map(updated)) - Math.max(...a.entries.map(updated)))
  })

  const byKey = createMemo(() => new Map(groups().map((group) => [group.key, group])))

  createEffect(() => inbox.loadBranches(groups().flatMap((group) => group.entries.slice(0, 1))))

  return (
    <div data-slot="brawl-sidebar" class="flex min-h-0 flex-1 flex-col">
      <div class="flex h-7 shrink-0 items-center px-1.5 text-[11px] leading-4 font-semibold tracking-[0.06em] text-v2-text-text-faint">
        {text().projects}
      </div>
      <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-1">
        <Show when={!inbox.loading() && groups().length === 0}>
          <div class="px-1.5 py-2 text-[13px] leading-4 text-v2-text-text-faint">{text().empty}</div>
        </Show>
        <For each={groups().map((group) => group.key)}>
          {(key) => (
            <Show when={byKey().get(key)}>
              {(group) => {
                const first = () => group().entries[0]!
                const project = createMemo(() => first().ctx.projects.forSession(first().session))
                const shown = () => (state.expanded[key] ? group().entries : group().entries.slice(0, SHOWN))
                const hidden = () => group().entries.length - SHOWN

                return (
                  <div data-slot="brawl-sidebar-project" class="flex shrink-0 flex-col gap-px">
                    <button
                      type="button"
                      aria-expanded={!state.collapsed[key]}
                      class="flex h-8 w-full items-center gap-2 rounded-[6px] px-1.5 text-start text-[13px] leading-4 font-medium text-v2-text-text-base hover:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none focus-visible:bg-v2-overlay-simple-overlay-hover"
                      onClick={() => setState("collapsed", key, !state.collapsed[key])}
                    >
                      <span class="flex size-4 shrink-0 items-center justify-center">
                        <SessionTabAvatarView
                          project={project()}
                          directory={first().session.location.directory}
                          unread={false}
                        />
                      </span>
                      <span class="min-w-0 truncate">
                        {displayName(project() ?? { worktree: first().session.location.directory })}
                      </span>
                      <Show when={inbox.branch(first())}>
                        {(branch) => (
                          <span
                            dir="ltr"
                            class="ms-auto min-w-0 shrink truncate text-[12px] font-normal text-v2-text-text-faint"
                          >
                            {branch()}
                          </span>
                        )}
                      </Show>
                    </button>
                    <Show when={!state.collapsed[key]}>
                      <For each={shown().map((entry) => entry.key)}>
                        {(entryKey) => (
                          <Show when={inbox.byKey().get(entryKey)}>
                            {(entry) => (
                              <SessionRow
                                entry={entry()}
                                selected={inbox.selected(entry())}
                                now={inbox.now()}
                                onOpen={() => inbox.open(entry())}
                                onArchive={() => void inbox.archive(entry())}
                              />
                            )}
                          </Show>
                        )}
                      </For>
                      <Show when={hidden() > 0}>
                        <button
                          type="button"
                          class="flex h-7 w-full items-center rounded-[6px] ps-7 text-start text-[12px] leading-4 text-v2-text-text-faint hover:text-v2-text-text-base focus-visible:outline-none focus-visible:bg-v2-overlay-simple-overlay-hover"
                          onClick={() => setState("expanded", key, !state.expanded[key])}
                        >
                          {state.expanded[key] ? text().less : text().more(hidden())}
                        </button>
                      </Show>
                    </Show>
                  </div>
                )
              }}
            </Show>
          )}
        </For>
      </div>
      <BrawlSidebarAccount entries={groups().flatMap((group) => group.entries)} text={text()} />
    </div>
  )
}

const dot: Record<InboxStatus, string> = {
  working: "var(--v2-icon-icon-accent)",
  approval: "var(--v2-state-fg-warning)",
  input: "var(--v2-state-fg-warning)",
  failed: "var(--v2-state-fg-danger)",
  done: "var(--v2-state-fg-success)",
  ready: "var(--v2-border-border-base)",
}

function SessionRow(props: {
  entry: InboxEntry
  selected: boolean
  now: number
  onOpen: () => void
  onArchive: () => void
}) {
  const language = useLanguage()
  const text = createMemo(() => sidebarText(language.locale()))
  const status = () => props.entry.status

  const meta = () => {
    const value = status()

    if (value === "ready")
      return text().age(props.now, props.entry.session.time.idle ?? props.entry.session.time.updated)

    if (value !== "working") return text().status[value]
    const since = workingSince(props.entry.session)

    if (since === undefined) return text().status.working

    return text().working(text().duration(Math.max(0, Math.floor((props.now - since) / 1000))))
  }

  return (
    <Menu.Context modal={false}>
      <Menu.Context.Trigger
        as="button"
        type="button"
        data-slot="brawl-sidebar-session"
        data-status={status()}
        data-state={props.selected ? "active" : undefined}
        class="flex w-full shrink-0 flex-col gap-0.5 rounded-[8px] py-1.5 pe-2 ps-2 text-start hover:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none focus-visible:bg-v2-overlay-simple-overlay-hover data-[state=active]:bg-v2-background-bg-layer-02 data-[state=active]:shadow-[inset_0_0_0_1px_var(--v2-border-border-muted)]"
        onClick={props.onOpen}
      >
        <span class="flex w-full min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            class="size-2 shrink-0 rounded-full"
            style={{
              background: dot[status()],
              "box-shadow": active(status())
                ? `0 0 0 3px color-mix(in srgb, ${dot[status()]} 22%, transparent)`
                : undefined,
            }}
          />
          <span
            dir="auto"
            class="min-w-0 truncate text-[13px] leading-4"
            classList={{
              "text-v2-text-text-base": props.selected || status() !== "ready",
              "text-v2-text-text-muted": !props.selected && status() === "ready",
            }}
          >
            {sessionTabTitle(props.entry.session.title, language.t("session.tab.session"))}
          </span>
        </span>
        <span
          class="min-w-0 truncate ps-4 text-[12px] leading-4 tabular-nums"
          role={status() === "ready" ? undefined : "status"}
          classList={{
            "text-v2-text-text-faint": status() === "ready" || status() === "working",
            "text-v2-state-fg-warning": status() === "approval" || status() === "input",
            "text-v2-state-fg-danger": status() === "failed",
            "text-v2-state-fg-success": status() === "done",
          }}
        >
          {meta()}
        </span>
      </Menu.Context.Trigger>
      <Menu.Context.Portal>
        <Menu.Context.Content>
          <Menu.Item onSelect={props.onArchive}>{language.t("common.archive")}</Menu.Item>
        </Menu.Context.Content>
      </Menu.Context.Portal>
    </Menu.Context>
  )
}
