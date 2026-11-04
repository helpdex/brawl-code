import { createMemo, createSignal, createUniqueId, onCleanup, onMount, Show, type JSX } from "solid-js"
import { useI18n } from "@opencode/ui/context/i18n"
import { commandResult, language, text } from "./timeline-text"

export function CommandResult(props: { exit: number; duration?: number }) {
  const i18n = useI18n()
  const result = createMemo(() => commandResult(props.exit, props.duration, language(i18n.locale())))

  return (
    <span data-component="brawl-command-result" data-ok={result().ok ? "true" : "false"}>
      <span aria-hidden="true">{result().ok ? "✓" : "✗"}</span>
      {result().text}
    </span>
  )
}

export function ChangeCount(props: { additions: number; deletions: number; added?: boolean }) {
  const i18n = useI18n()

  return (
    <>
      <Show when={props.added}>
        <span data-slot="brawl-change-added">{text[language(i18n.locale())].added}</span>
      </Show>
      <Show when={props.additions + props.deletions > 0}>
        <div data-component="diff-changes" data-appearance="standard">
          <Show when={props.additions > 0}>
            <span data-slot="diff-changes-additions">{`+${props.additions}`}</span>
          </Show>
          <Show when={props.deletions > 0}>
            <span data-slot="diff-changes-deletions">{`−${props.deletions}`}</span>
          </Show>
        </div>
      </Show>
    </>
  )
}

const PREVIEW_LINES = 12

const PREVIEW_SLACK = 2

export function DiffPreview(props: { children: JSX.Element; onToggle?: () => void }) {
  const i18n = useI18n()
  const id = createUniqueId()
  const words = () => text[language(i18n.locale())]
  const [open, setOpen] = createSignal(false)
  const [cut, setCut] = createSignal<{ height: number; hidden: number }>()
  let content: HTMLDivElement | undefined

  const measure = () => {
    if (!content) return
    const top = content.getBoundingClientRect().top
    const rows = new Map<number, number>()
    content.querySelectorAll("diffs-container").forEach((host) =>
      host.shadowRoot?.querySelectorAll("[data-line]").forEach((row) => {
        const box = row.getBoundingClientRect()
        rows.set(Math.round(box.top - top), Math.round(box.bottom - top))
      }),
    )
    const bottoms = [...rows.values()].sort((a, b) => a - b)

    const next =
      bottoms.length > PREVIEW_LINES + PREVIEW_SLACK
        ? { height: bottoms[PREVIEW_LINES - 1]!, hidden: bottoms.length - PREVIEW_LINES }
        : undefined

    const previous = cut()

    if (previous?.height === next?.height && previous?.hidden === next?.hidden) return
    setCut(next)
  }

  onMount(() => {
    if (!content) return
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    onCleanup(() => observer.disconnect())
  })

  const toggle = () => {
    setOpen(!open())
    props.onToggle?.()
  }

  return (
    <div data-component="brawl-diff-preview" data-cut={cut() && !open() ? "" : undefined}>
      <div
        id={`${id}-body`}
        data-slot="brawl-diff-preview-body"
        style={{ "max-height": cut() && !open() ? `${cut()!.height}px` : undefined }}
      >
        <div ref={content}>{props.children}</div>
      </div>
      <Show when={cut()}>
        {(value) => (
          <button
            type="button"
            data-slot="brawl-diff-preview-more"
            aria-expanded={open()}
            aria-controls={`${id}-body`}
            onClick={toggle}
          >
            {open() ? words().less : `… ${words().more(value().hidden)}`}
          </button>
        )}
      </Show>
    </div>
  )
}
