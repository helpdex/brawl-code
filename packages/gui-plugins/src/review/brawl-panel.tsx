import { Show, type ComponentProps } from "solid-js"
import ReviewPanelContent from "./panel"
import { BrawlReviewActions } from "./brawl-actions"

export default function BrawlReviewPanel(props: ComponentProps<typeof ReviewPanelContent>) {
  return (
    <div class="flex h-full min-h-0 flex-col">
      <div class="min-h-0 flex-1">
        <ReviewPanelContent {...props} />
      </div>
      <Show when={!props.review.noGit()}>
        <BrawlReviewActions review={props.review} />
      </Show>
    </div>
  )
}
