import { createEffect, createMemo, onCleanup, Show } from "solid-js"
import type { InboxEntry } from "@/shell/titlebar/inbox-model"
import { usePlatform } from "@/runtime/platform/platform"
import type { SidebarText } from "./sidebar-text"

const REFRESH = 5 * 60_000

export function BrawlSidebarAccount(props: { entries: InboxEntry[]; text: SidebarText }) {
  const platform = usePlatform()

  const source = createMemo(() => props.entries[0], undefined, {
    equals: (a, b) => a?.ctx === b?.ctx && a?.session.location.directory === b?.session.location.directory,
  })

  const ref = () => {
    const entry = source()

    return entry ? { directory: entry.session.location.directory } : undefined
  }

  createEffect(() => {
    const entry = source()
    const location = ref()

    if (!entry || !location) return
    const load = () => void entry.ctx.data.location.usage.sync(location).catch(() => undefined)
    load()

    const timer = setInterval(() => {
      entry.ctx.data.location.usage.invalidate(location)
      load()
    }, REFRESH)

    onCleanup(() => clearInterval(timer))
  })

  const account = createMemo(() => {
    const entry = source()
    const location = ref()

    return entry && location ? entry.ctx.data.location.usage.limits(location)?.brawl : undefined
  })

  const running = () => props.entries.filter((entry) => entry.status === "working").length
  const fullest = createMemo(() => account()?.windows.toSorted((a, b) => b.percent - a.percent)[0])

  const meter = () => {
    const window = fullest()

    if (window) return window.percent
    const limit = account()?.concurrent

    return limit ? Math.min(100, (running() / limit) * 100) : 0
  }

  return (
    <Show when={account()}>
      {(value) => (
        <div
          data-slot="brawl-sidebar-account"
          class="mt-1 flex shrink-0 flex-col gap-3 border-t border-v2-border-border-muted px-1.5 pt-3 pb-1"
        >
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2 text-[12px] leading-4">
              <span class="text-v2-text-text-muted">{props.text.plan(value().plan)}</span>
              <Show
                when={fullest()}
                fallback={
                  <Show when={value().concurrent}>
                    {(limit) => (
                      <span class="font-mono text-v2-text-text-faint">
                        {props.text.streams(Math.min(running(), limit()), limit())}
                      </span>
                    )}
                  </Show>
                }
              >
                {(window) => (
                  <span class={`font-mono ${window().limited ? "text-v2-state-fg-danger" : "text-v2-text-text-faint"}`}>
                    {window().used !== undefined && window().limit !== undefined
                      ? props.text.steps(window().used ?? 0, window().limit ?? 0)
                      : props.text.window(window().id, Math.round(window().percent))}
                  </span>
                )}
              </Show>
            </div>
            <div class="h-1 overflow-hidden rounded-full bg-v2-background-bg-layer-02">
              <div
                class="h-1 rounded-full bg-v2-icon-icon-accent"
                classList={{ "opacity-35": !fullest() }}
                style={{ width: `${meter()}%` }}
              />
            </div>
          </div>
          <Show when={value().email}>
            {(email) => (
              <button
                type="button"
                title={props.text.usage}
                class="flex min-w-0 items-center gap-2.5 rounded-[8px] text-start focus-visible:outline-none focus-visible:bg-v2-overlay-simple-overlay-hover"
                onClick={() => platform.openExternal(value().usageURL)}
              >
                <span class="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-[#4D2413] bg-[#24130D] text-[13px] font-bold text-[#FF7A45]">
                  {email().charAt(0).toUpperCase()}
                </span>
                <span class="flex min-w-0 flex-col">
                  <span class="truncate text-[13px] leading-4 font-medium text-v2-text-text-base">
                    {email().split("@")[0]}
                  </span>
                  <span class="truncate text-[12px] leading-4 text-v2-text-text-faint">{email()}</span>
                </span>
              </button>
            )}
          </Show>
        </div>
      )}
    </Show>
  )
}
