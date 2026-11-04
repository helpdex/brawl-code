import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import type { FileDiffInfo } from "@opencode/client/promise"
import { Button } from "@opencode/ui/button"
import { useDialog } from "@opencode/ui/context/dialog"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitleGroup } from "@opencode/ui/dialog"
import { Icon } from "@opencode/ui/icon"
import { Menu } from "@opencode/ui/menu"
import { Textarea } from "@opencode/ui/textarea"
import { showToast } from "@opencode/ui/toast"
import { usePlugin } from "@opencode/plugin/gui"
import type Review from "./index"
import type { ReviewModel } from "./model"
import { reviewText, type ReviewText } from "./brawl-text"

const SHOWN_FILES = 8

export function BrawlReviewActions(props: { review: ReviewModel }) {
  const ctx = usePlugin<typeof Review>()
  const dialog = useDialog()
  const text = createMemo(() => reviewText(ctx.locale.locale()))
  const view = () => props.review.view()
  const directory = () => props.review.screen.file.root

  const busy = () => {
    const status = view().server.data.session.status(view().id)

    return status !== undefined && status !== "idle"
  }

  const branch = () => view().server.data.location.vcs.info({ directory: directory() })?.branch.current
  const canRevert = () => props.review.mode() !== "branch" && props.review.diffs().length > 0
  const revertDisabled = () => props.review.mode() === "turn" && busy()

  const openRevert = () =>
    dialog.show(() => (
      <RevertDialog
        text={text()}
        mode={props.review.mode() === "turn" ? "turn" : "git"}
        diffs={props.review.diffs()}
        run={(files) => {
          const client = view().server.client
          const location = { directory: directory() }

          return (
            props.review.mode() === "turn"
              ? client.brawl.session.discard({ sessionID: view().id, location, files })
              : client.brawl.git.discard({ location, files })
          ).then((result) => result.data.files)
        }}
        done={(count) => {
          dialog.close()
          props.review.reload()
          showToast({ variant: "success", title: text().reverted(count) })
        }}
        close={() => dialog.close()}
      />
    ))

  const openCommit = () =>
    dialog.show(() => (
      <CommitDialog
        text={text()}
        branch={branch()}
        status={() =>
          view()
            .server.client.vcs.status({ location: { directory: directory() } })
            .then((result) => result.data)
        }
        message={() =>
          view()
            .server.client.brawl.git.message({ location: { directory: directory() }, sessionID: view().id })
            .then((result) => result.data.message)
        }
        commit={(message, push) =>
          view()
            .server.client.brawl.git.commit({ location: { directory: directory() }, message, push })
            .then((result) => result.data)
        }
        done={(result) => {
          dialog.close()
          props.review.reload()
          const title = text().committed(result.hash, result.branch)

          if (result.pushError)
            return showToast({
              variant: "error",
              title: text().pushFailed,
              description: `${title}. ${result.pushError}`,
            })
          showToast({ variant: "success", title, description: result.pushed ? text().pushed : undefined })
        }}
        close={() => dialog.close()}
      />
    ))

  return (
    <div data-component="brawl-review-actions">
      <Show when={canRevert()}>
        <Button
          variant="ghost"
          disabled={revertDisabled()}
          title={revertDisabled() ? text().revertBusy : undefined}
          onClick={openRevert}
        >
          {text().revertAll}
        </Button>
      </Show>
      <Button variant="neutral" class="brawl-review-commit" onClick={openCommit}>
        {text().commit}
      </Button>
    </div>
  )
}

function RevertDialog(props: {
  text: ReviewText
  mode: "git" | "turn"
  diffs: FileDiffInfo[]
  run: (files: string[]) => Promise<readonly string[]>
  done: (count: number) => void
  close: () => void
}) {
  const [pending, setPending] = createSignal(false)
  const [error, setError] = createSignal<string>()
  const files = () => props.diffs.map((diff) => diff.file)
  const count = () => props.diffs.length

  const confirm = () => {
    if (pending()) return
    setPending(true)
    setError(undefined)
    props
      .run(files())
      .then((reverted) => props.done(reverted.length))
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setPending(false))
  }

  return (
    <Dialog fit class="brawl-review-dialog">
      <DialogHeader hideClose>
        <DialogTitleGroup
          title={props.text.revertTitle}
          description={props.mode === "turn" ? props.text.revertTurn(count()) : props.text.revertGit(count())}
        />
      </DialogHeader>
      <DialogBody>
        <div data-slot="brawl-review-files">
          <For each={props.diffs.slice(0, SHOWN_FILES)}>
            {(diff) => (
              <div data-slot="brawl-review-file">
                <span data-slot="brawl-review-path">{diff.file}</span>
                <Show
                  when={diff.status !== "added"}
                  fallback={<span data-slot="brawl-review-removed">{props.text.removed}</span>}
                >
                  <Show when={diff.additions > 0}>
                    <span data-slot="brawl-review-add">+{diff.additions}</span>
                  </Show>
                  <Show when={diff.deletions > 0}>
                    <span data-slot="brawl-review-del">−{diff.deletions}</span>
                  </Show>
                </Show>
              </div>
            )}
          </For>
          <Show when={count() > SHOWN_FILES}>
            <div data-slot="brawl-review-more">{props.text.more(count() - SHOWN_FILES)}</div>
          </Show>
        </div>
        <Show when={error()}>
          <div data-slot="brawl-review-error">
            {props.text.revertFailed}: {error()}
          </div>
        </Show>
      </DialogBody>
      <DialogFooter>
        <Button variant="neutral" autofocus onClick={() => props.close()}>
          {props.text.cancel}
        </Button>
        <Button variant="danger" disabled={pending()} onClick={confirm}>
          {props.text.revertButton(count())}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

type Commit = { hash: string; branch?: string; pushed: boolean; pushError?: string }

function CommitDialog(props: {
  text: ReviewText
  branch?: string
  status: () => Promise<ReadonlyArray<{ additions: number; deletions: number }>>
  message: () => Promise<string>
  commit: (message: string, push: boolean) => Promise<Commit>
  done: (result: Commit) => void
  close: () => void
}) {
  const [status] = createResource(props.status)
  const [value, setValue] = createSignal("")
  const [phase, setPhase] = createSignal<"idle" | "writing" | "committing" | "pushing">("idle")
  const [error, setError] = createSignal<string>()
  const [menu, setMenu] = createSignal(false)

  const totals = createMemo(() =>
    (status() ?? []).reduce(
      (sum, row) => ({ additions: sum.additions + row.additions, deletions: sum.deletions + row.deletions }),
      { additions: 0, deletions: 0 },
    ),
  )

  const working = () => phase() !== "idle"

  const labels = () => ({
    idle: props.text.commitAction,
    writing: props.text.writing,
    committing: props.text.committing,
    pushing: props.text.pushing,
  })

  const label = () => labels()[phase()]

  const submit = async (push: boolean) => {
    if (working()) return
    setMenu(false)
    setError(undefined)

    try {
      let message = value().trim()

      if (!message) {
        setPhase("writing")
        message = await props.message()
        setValue(message)
      }

      setPhase(push ? "pushing" : "committing")
      props.done(await props.commit(message, push))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setPhase("idle")
    }
  }

  return (
    <Dialog fit class="brawl-review-dialog" preventBackdropDismiss={working()}>
      <DialogHeader hideClose>
        <DialogTitleGroup
          title={props.text.commitTitle}
          description={
            <span data-slot="brawl-commit-meta">
              <Show when={props.branch}>
                {(branch) => (
                  <span data-slot="brawl-commit-branch">
                    <Icon name="branch" size="small" />
                    {branch()}
                  </span>
                )}
              </Show>
              <Show when={status()}>
                {(rows) => (
                  <>
                    <span>{props.text.files(rows().length)}</span>
                    <Show when={totals().additions > 0}>
                      <span data-slot="brawl-review-add">+{totals().additions}</span>
                    </Show>
                    <Show when={totals().deletions > 0}>
                      <span data-slot="brawl-review-del">−{totals().deletions}</span>
                    </Show>
                  </>
                )}
              </Show>
            </span>
          }
        />
      </DialogHeader>
      <DialogBody>
        <Textarea
          rows={5}
          value={value()}
          disabled={working()}
          placeholder={props.text.placeholder}
          onInput={(event) => setValue(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              void submit(false)
            }
          }}
          autofocus
        />
        <Show when={error()}>
          <div data-slot="brawl-review-error">
            {props.text.commitFailed}: {error()}
          </div>
        </Show>
      </DialogBody>
      <DialogFooter>
        <span data-slot="brawl-commit-note">{props.text.includes}</span>
        <Button variant="ghost" disabled={working()} onClick={() => props.close()}>
          {props.text.cancel}
        </Button>
        <div class="brawl-commit-split">
          <Button variant="neutral" disabled={working()} onClick={() => void submit(false)}>
            {label()}
          </Button>
          <Menu gutter={4} modal={false} placement="bottom-end" open={menu()} onOpenChange={setMenu}>
            <Menu.Trigger as={Button} variant="neutral" disabled={working()} aria-label={props.text.commitMenu}>
              <Icon name="chevron-down" size="small" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content class="brawl-commit-menu">
                <Menu.Item onSelect={() => void submit(false)}>
                  <span data-slot="brawl-commit-item">
                    <span>{props.text.commitAction}</span>
                    <span data-slot="brawl-commit-hint">{props.text.commitLocal}</span>
                  </span>
                </Menu.Item>
                <Menu.Item onSelect={() => void submit(true)}>
                  <span data-slot="brawl-commit-item">
                    <span>{props.text.commitPush}</span>
                    <Show when={props.branch}>
                      {(branch) => <span data-slot="brawl-commit-hint">{props.text.pushTo(`origin/${branch()}`)}</span>}
                    </Show>
                  </span>
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu>
        </div>
      </DialogFooter>
    </Dialog>
  )
}
