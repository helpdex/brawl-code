import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { BrawlPlugin } from "@opencode/core/brawl/plugin"
import { BrawlTools } from "@opencode/core/brawl/tools"
import { Integration } from "@opencode/core/integration"
import { Location } from "@opencode/core/location"
import { Model } from "@opencode/core/model"
import { Plugin } from "@opencode/core/plugin"
import { PluginHost } from "@opencode/core/plugin/host"
import { Provider } from "@opencode/core/provider"
import { Session } from "@opencode/core/session"
import { Tool } from "@opencode/core/tool"
import { WebSearch } from "@opencode/core/websearch"
import { testEffect } from "../lib/effect"
import { executeTool, toolIdentity } from "../lib/tool"
import { PluginTestLayer } from "../plugin/fixture"

const it = testEffect(PluginTestLayer)
const integrationID = Integration.ID.make("brawl")

function api() {
  const requests: { path: string; auth: string | null; body: unknown }[] = []
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const url = new URL(request.url)
      const body = await request.json().catch(() => undefined)
      requests.push({ path: url.pathname, auth: request.headers.get("authorization"), body })
      if (request.headers.get("authorization") !== "Bearer brawl_sk_test")
        return Response.json({ error: { message: "Invalid API Key" } }, { status: 401 })
      if (url.pathname === "/v1/tools/web_search")
        return Response.json({
          results: [
            {
              url: "https://github.com/phoenixframework/phoenix/releases",
              title: "Releases",
              content: "## v1.8.16",
              published: "2026-10-20",
            },
            { url: "https://hexdocs.pm/phoenix" },
          ],
        })
      if (url.pathname === "/v1/tools/docs") {
        if ((body as { query?: string }).query === "down")
          return Response.json(
            { error: { message: "The documentation search is unavailable right now" } },
            { status: 503 },
          )
        return Response.json({ text: "Use into: fn {:data, data}, acc -> ... end" })
      }
      return new Response("Not found", { status: 404 })
    },
  })
  return { server, requests }
}

const setup = (origin: string, signedIn = true) =>
  Effect.gen(function* () {
    const plugins = yield* Plugin.Service
    const host = yield* PluginHost.make(plugins)
    yield* BrawlPlugin.Plugin.effect(host)
    yield* BrawlTools.Plugin.effect(host)
    if (signedIn) {
      const integrations = yield* Integration.Service
      yield* integrations.connection.key({
        integrationID,
        key: "brawl_sk_test",
        answer: { site: origin, api: `${origin}/v1` },
      })
    }
    const sessions = yield* Session.Service
    const location = yield* Location.Service
    const session = yield* sessions.create({
      location: Location.Ref.make({ directory: location.directory }),
      model: Model.Ref.make({ providerID: Provider.ID.make("brawl"), id: Model.ID.make("brawl-code") }),
    })
    const registry = yield* Tool.Service
    const docs = (input: Record<string, unknown>) =>
      executeTool(registry, {
        sessionID: session.id,
        ...toolIdentity,
        call: { type: "tool-call", id: `call-${JSON.stringify(input)}`, name: BrawlTools.docsName, input },
      })
    return { docs }
  })

describe("BrawlTools", () => {
  it.live("searches the web through Brawl, its default provider", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => api()),
      ({ server, requests }) =>
        Effect.gen(function* () {
          yield* setup(server.url.origin)
          const websearch = yield* WebSearch.Service
          expect(yield* websearch.default()).toEqual({ id: WebSearch.ID.make("brawl"), name: "Brawl" })
          const response = yield* websearch.query({ query: "Phoenix latest release" })
          expect(response.providerID).toBe(WebSearch.ID.make("brawl"))
          expect(response.results).toEqual([
            {
              url: "https://github.com/phoenixframework/phoenix/releases",
              title: "Releases",
              content: "## v1.8.16",
              time: { published: Date.parse("2026-10-20") },
            },
            { url: "https://hexdocs.pm/phoenix", time: {} },
          ])
          expect(requests.filter((request) => request.path.startsWith("/v1/tools/"))).toEqual([
            {
              path: "/v1/tools/web_search",
              auth: "Bearer brawl_sk_test",
              body: { query: "Phoenix latest release" },
            },
          ])
        }),
      ({ server }) => Effect.promise(() => server.stop(true)),
    ),
  )

  it.live("looks the documentation up with the docs tool and says why it could not", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => api()),
      ({ server, requests }) =>
        Effect.gen(function* () {
          const { docs } = yield* setup(server.url.origin)
          const found = yield* docs({ query: "How do I stream a body with Req?", libraries: ["Req"] })
          expect(JSON.stringify(found)).toContain("Use into:")
          expect(requests.find((request) => request.path === "/v1/tools/docs")).toEqual({
            path: "/v1/tools/docs",
            auth: "Bearer brawl_sk_test",
            body: { query: "How do I stream a body with Req?", libraries: ["Req"] },
          })
          const failed = yield* docs({ query: "down" })
          expect(JSON.stringify(failed)).toContain("The documentation search is unavailable right now")
        }),
      ({ server }) => Effect.promise(() => server.stop(true)),
    ),
  )

  it.live("asks to sign in to Brawl first", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => api()),
      ({ server, requests }) =>
        Effect.gen(function* () {
          const { docs } = yield* setup(server.url.origin, false)
          const failed = yield* docs({ query: "anything" })
          expect(JSON.stringify(failed)).toContain("Sign in to Brawl first")
          const websearch = yield* WebSearch.Service
          expect(yield* websearch.query({ query: "x" }).pipe(Effect.flip)).toBeInstanceOf(WebSearch.RequestError)
          expect(requests.filter((request) => request.path.startsWith("/v1/tools/"))).toEqual([])
        }),
      ({ server }) => Effect.promise(() => server.stop(true)),
    ),
  )
})
