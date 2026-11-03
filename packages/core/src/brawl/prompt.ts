export * as BrawlPrompt from "./prompt.js"

import { define } from "@opencode/plugin/effect/plugin"
import type { SessionHooks } from "@opencode/plugin/effect/session"
import { Brawl } from "@opencode/util/brawl"
import { Effect } from "effect"
import { SessionSystemPrompt } from "../session/system-prompt.js"
import PROMPT from "./system.txt"

export const Plugin = define({
  id: "brawl.prompt",
  effect: Effect.fn("BrawlPrompt")(function* (ctx) {
    const hook = (event: SessionHooks["context"]) =>
      Effect.gen(function* () {
        const system = event.system[0]
        if (!system) return
        if ((yield* ctx.agent.get({ agentID: event.agent })).data.system) return
        const text =
          event.model.providerID === Brawl.id
            ? SessionSystemPrompt.render(PROMPT, Object.keys(event.tools))
            : rename(system.text)
        event.system[0] = { ...system, text }
      }).pipe(Effect.catch(() => Effect.void))
    yield* ctx.session.hook("context", hook)
    yield* ctx.session.hook("compaction", hook)
    yield* ctx.session.hook("generate", hook)
  }),
})

export function rename(text: string) {
  return text.replaceAll("OpenCode", Brawl.name).replace(/^You are opencode\b/, `You are ${Brawl.name}`)
}
