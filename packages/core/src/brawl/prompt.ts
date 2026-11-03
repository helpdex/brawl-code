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
        const text = event.model.providerID === Brawl.id ? brawl(Object.keys(event.tools)) : rename(system.text)
        event.system[0] = { ...system, text }
      }).pipe(Effect.catch(() => Effect.void))
    yield* ctx.session.hook("context", hook)
    yield* ctx.session.hook("compaction", hook)
    yield* ctx.session.hook("generate", hook)
  }),
})

export function brawl(tools: string[]) {
  const lookups = [
    tools.includes("docs") &&
      "- Before you write or change code that relies on a library, framework, SDK or API, check its current documentation with the docs tool rather than your memory: the code should fit the version in use today.",
    tools.includes("websearch") &&
      "- Search the web with websearch when the answer depends on something recent or that you are not sure of: news, current versions, prices, an error message. Link the pages you used.",
  ].filter((line): line is string => typeof line === "string")
  const prompt = lookups.length
    ? PROMPT.replace("${OPENCODE_TOOL_GUIDANCE}", ["${OPENCODE_TOOL_GUIDANCE}", ...lookups].join("\n"))
    : PROMPT
  return SessionSystemPrompt.render(prompt, tools)
}

export function rename(text: string) {
  return text.replaceAll("OpenCode", Brawl.name).replace(/^You are opencode\b/, `You are ${Brawl.name}`)
}
