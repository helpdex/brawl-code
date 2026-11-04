import { describe, expect } from "bun:test"
import { SystemPart } from "@opencode/ai/effect"
import { Agent } from "@opencode/core/agent"
import { BrawlPrompt } from "@opencode/core/brawl/prompt"
import { Plugin } from "@opencode/core/plugin"
import { PluginHooks } from "@opencode/core/plugin/hooks"
import { PluginHost } from "@opencode/core/plugin/host"
import { OptimizePlugin } from "@opencode/core/plugin/optimize"
import { Provider } from "@opencode/core/provider"
import { Session } from "@opencode/core/session"
import { SessionSystemPrompt } from "@opencode/core/session/system-prompt"
import type { SessionHooks } from "@opencode/plugin/effect/session"
import { Model } from "@opencode/schema/model"
import { Effect } from "effect"
import { testEffect } from "../lib/effect"
import { PluginTestLayer } from "../plugin/fixture"
import PROMPT from "../../src/brawl/system.txt"
import PROMPT_KIMI from "../../src/plugin/system-prompt/kimi.txt"
import PROMPT_TRINITY from "../../src/plugin/system-prompt/trinity.txt"

const it = testEffect(PluginTestLayer)
const tools = ["shell", "read", "grep", "glob", "edit", "write"]

const context = (providerID: string, id: string, agent = "build"): SessionHooks["context"] => ({
  sessionID: Session.ID.make("ses_brawl_prompt"),
  agent: Agent.ID.make(agent),
  model: Model.Ref.make({ providerID: Provider.ID.make(providerID), id: Model.ID.make(id) }),
  system: [SystemPart.make(SessionSystemPrompt.make(tools)), SystemPart.make("Project instructions")],
  messages: [],
  tools: Object.fromEntries(tools.map((name) => [name, { description: name, input: { type: "object" } }])),
  options: {},
})

const setup = Effect.gen(function* () {
  const agents = yield* Agent.Service
  const plugins = yield* Plugin.Service
  const catalog = yield* Provider.Service
  yield* agents.transform((editor) => {
    editor.update(Agent.ID.make("build"), () => {})
    editor.update(Agent.ID.make("reviewer"), (agent) => {
      agent.system = "You review diffs for OpenCode contributors."
    })
  })
  yield* catalog.transform((editor) => {
    editor.models.update(Provider.ID.make("brawl"), Model.ID.make("brawl-code"), () => {})
    for (const id of ["kimi-k2", "trinity", "llama-3.3"])
      editor.models.update(Provider.ID.make("test"), Model.ID.make(id), () => {})
  })
  const host = yield* PluginHost.make(plugins)
  yield* Effect.forEach([...OptimizePlugin.Plugins, BrawlPrompt.Plugin], (plugin) => plugin.effect(host), {
    discard: true,
  })
  return yield* PluginHooks.Service
})

describe("BrawlPrompt", () => {
  it.effect("gives Brawl's models Brawl Code's prompt and keeps the project's instructions", () =>
    Effect.gen(function* () {
      const hooks = yield* setup
      const event = context("brawl", "brawl-code")
      yield* hooks.trigger("session", "context", event)

      expect(event.system.map((part) => part.text)).toEqual([
        SessionSystemPrompt.render(PROMPT, tools),
        "Project instructions",
      ])
      expect(event.system[0]?.text).toStartWith("You are Brawl Code, Brawl's coding agent.")
      expect(event.system[0]?.text).toContain("Prefer dedicated tools over shell commands")
      expect(event.system[0]?.text).not.toContain("OpenCode")
    }),
  )

  it.effect("names the harness Brawl Code in OpenCode's prompts for other models", () =>
    Effect.gen(function* () {
      const hooks = yield* setup
      const cases = [
        ["llama-3.3", SessionSystemPrompt.make(tools)],
        ["kimi-k2", SessionSystemPrompt.render(PROMPT_KIMI, tools)],
        ["trinity", SessionSystemPrompt.render(PROMPT_TRINITY, tools)],
      ] as const
      for (const [id, upstream] of cases) {
        const event = context("test", id)
        yield* hooks.trigger("session", "context", event)
        expect(event.system[0]?.text).toBe(BrawlPrompt.rename(upstream))
        expect(event.system[0]?.text).not.toMatch(/OpenCode|You are opencode/)
      }
      expect(BrawlPrompt.rename(SessionSystemPrompt.make(tools))).toStartWith(
        "You are an AI agent running in Brawl Code, a coding agent harness.",
      )
    }),
  )

  it.effect("leaves an agent's own system prompt as written", () =>
    Effect.gen(function* () {
      const hooks = yield* setup
      const event = context("brawl", "brawl-code", "reviewer")
      const before = event.system.map((part) => part.text)
      yield* hooks.trigger("session", "context", event)
      expect(event.system.map((part) => part.text)).toEqual(before)
    }),
  )
  it.effect("tells Brawl's models when to use Brawl's docs and web search", () =>
    Effect.sync(() => {
      const prompt = BrawlPrompt.brawl([...tools, "docs", "websearch"])
      expect(prompt).toContain("check its current documentation with the docs tool")
      expect(prompt).toContain("Search the web with websearch")
      expect(prompt.indexOf("Use the edit tool")).toBeLessThan(prompt.indexOf("docs tool"))
      expect(BrawlPrompt.brawl(tools)).toBe(SessionSystemPrompt.render(PROMPT, tools))
      expect(BrawlPrompt.brawl([...tools, "todowrite"])).toContain("write the plan with todowrite before you start")
      expect(BrawlPrompt.brawl(tools)).not.toContain("todowrite")
    }),
  )
})
