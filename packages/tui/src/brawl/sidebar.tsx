import { Plugin } from "@opencode/plugin/tui"
import { Brawl } from "@opencode/util/brawl"
import { createEffect, Show } from "solid-js"
import { useUsageLimits } from "../component/usage"
import { useLocal } from "../context/local"
import { SidebarBrawlAccount } from "./usage"

export function SidebarBrawl() {
  const local = useLocal()
  const limits = useUsageLimits()
  const brawl = () => local.model.current()?.providerID === Brawl.id
  createEffect(() => {
    if (brawl() && limits.info() === undefined) limits.load()
  })
  return <Show when={brawl() && limits.info()?.brawl}>{(account) => <SidebarBrawlAccount account={account()} />}</Show>
}

export default Plugin.define({
  id: "brawl.sidebar.account",
  setup(context) {
    context.ui.slot({
      append: "sidebar.content",
      render: () => <SidebarBrawl />,
    })
  },
})
