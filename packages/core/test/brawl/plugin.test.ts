import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { BrawlPlugin } from "@opencode/core/brawl/plugin"
import { Credential } from "@opencode/core/credential"
import { Integration } from "@opencode/core/integration"
import { Model } from "@opencode/core/model"
import { Plugin } from "@opencode/core/plugin"
import { PluginHost } from "@opencode/core/plugin/host"
import { Provider } from "@opencode/core/provider"
import { testEffect } from "../lib/effect"
import { PluginTestLayer } from "../plugin/fixture"

const it = testEffect(PluginTestLayer)
const integrationID = Integration.ID.make("brawl")
const browser = Integration.MethodID.make("browser")
const providerID = Provider.ID.make("brawl")

const addPlugin = Effect.fn(function* () {
  const plugin = yield* Plugin.Service
  const host = yield* PluginHost.make(plugin)
  yield* BrawlPlugin.Plugin.effect(host)
})

const manifest = {
  config: {
    model: "brawl/brawl-code",
    providers: {
      brawl: {
        name: "brawl.io",
        package: "@opencode/ai/providers/openai-compatible",
        settings: { baseURL: "https://llm.brawl.io/v1", apiKey: "{env:BRAWL_API_KEY}" },
        models: {
          "brawl-code": {
            name: "Brawl Code 1.0",
            capabilities: { reasoning: { supported: true } },
            limit: { context: 1048576, output: 32768 },
            variants: [{ id: "1M", body: { model: "brawl-code-1m" } }],
          },
          "brawl-code-next": { name: "Brawl Code Next", limit: { context: 262144, output: 32768 } },
        },
      },
    },
  },
  auth: { command: ["brawl", "login", "--print-key", "--agent", "opencode"], env: "BRAWL_API_KEY" },
}

function site(token: (polls: number) => Response = () => Response.json({ access_token: "brawl_sk_test" })) {
  const requests: string[] = []
  const devices: Record<string, string>[] = []
  const polls = { count: 0 }
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const url = new URL(request.url)
      requests.push(`${request.method} ${url.pathname}`)
      if (url.pathname === "/api/device/code") {
        devices.push(Object.fromEntries(new URLSearchParams(await request.text())))
        return Response.json({
          device_code: "device",
          user_code: "KDPR-XWMT",
          verification_uri: `${url.origin}/device`,
          verification_uri_complete: `${url.origin}/device?code=KDPR-XWMT`,
          expires_in: 600,
          interval: 0,
        })
      }
      if (url.pathname === "/api/device/token") {
        polls.count += 1
        if (polls.count === 1) return Response.json({ error: "authorization_pending" }, { status: 400 })
        return token(polls.count)
      }
      if (url.pathname === "/v1/account") {
        if (request.headers.get("authorization") !== "Bearer brawl_sk_test") return new Response(null, { status: 401 })
        return Response.json({ email: "owner@example.com", plan: "beta", limits: null })
      }
      if (url.pathname === "/.well-known/opencode") return Response.json(manifest)
      return new Response("Not found", { status: 404 })
    },
  })
  return { server, requests, devices }
}

function eventually<A, E>(
  effect: Effect.Effect<A, E>,
  predicate: (value: A) => boolean,
  deadline = Date.now() + 10_000,
): Effect.Effect<A, E | Error> {
  return Effect.gen(function* () {
    const value = yield* effect
    if (predicate(value)) return value
    if (Date.now() > deadline) return yield* Effect.fail(new Error("Timed out waiting for value"))
    yield* Effect.promise(() => Bun.sleep(5))
    return yield* eventually(effect, predicate, deadline)
  })
}

describe("BrawlPlugin", () => {
  it.effect("offers sign-in through the browser, a key and BRAWL_API_KEY", () =>
    Effect.gen(function* () {
      yield* addPlugin()
      const integrations = yield* Integration.Service
      const integration = yield* integrations.get(integrationID)
      expect(integration?.name).toBe("Brawl")
      expect(integration?.methods.map((method) => [method.type, "label" in method ? method.label : undefined])).toEqual(
        [
          ["oauth", "Brawl account (sign in through the browser)"],
          ["key", "Brawl API key (brawl_sk_…)"],
          ["env", undefined],
        ],
      )
    }),
  )

  it.effect("leaves OpenCode Console and its models out", () =>
    Effect.gen(function* () {
      const providers = yield* Provider.Service
      yield* providers.transform((editor) => {
        editor.update(Provider.ID.opencode, (provider) => {
          provider.package = "@opencode/ai/providers/openai-compatible"
          provider.activation = "enabled"
        })
      })
      yield* addPlugin()
      expect(yield* providers.get(Provider.ID.opencode)).toBeUndefined()
      const integrations = yield* Integration.Service
      expect(yield* integrations.get(Integration.ID.make("opencode"))).toBeUndefined()
      expect(yield* integrations.get(Integration.ID.make("opencode-go"))).toBeUndefined()
    }),
  )

  it.live("signs in through the browser and adds the models the site names", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => site()),
      ({ server, requests, devices }) =>
        Effect.gen(function* () {
          yield* addPlugin()
          const integrations = yield* Integration.Service
          const origin = server.url.origin
          const attempt = yield* integrations.oauth.connect({
            integrationID,
            methodID: browser,
            answer: { site: `${origin}/`, api: `${origin}/v1` },
          })
          expect(attempt.url).toBe(`${origin}/device?code=KDPR-XWMT`)
          expect(attempt.instructions).toBe(`Check that ${server.url.host} shows KDPR-XWMT and press Connect`)
          const status = yield* eventually(
            integrations.oauth.status({ integrationID, attemptID: attempt.attemptID }),
            (value) => value.status !== "pending",
          )
          expect(status.status).toBe("complete")
          expect(devices[0]?.client_id).toBe("brawl-code")
          expect(devices[0]?.device_name).toBeTruthy()

          const credentials = yield* Credential.Service
          const saved = (yield* credentials.list(integrationID))[0]
          expect(saved?.label).toBe("owner@example.com")
          expect(saved?.value).toMatchObject({
            type: "oauth",
            methodID: browser,
            access: "brawl_sk_test",
            metadata: { site: origin, api: `${origin}/v1`, email: "owner@example.com" },
          })

          const providers = yield* Provider.Service
          const provider = yield* eventually(providers.get(providerID), (value) => value !== undefined)
          expect(provider?.name).toBe("Brawl")
          expect(provider?.settings?.baseURL).toBe(`${origin}/v1`)
          expect(provider?.settings?.apiKey).toBeUndefined()
          const models = yield* Model.Service
          const model = yield* models.get(providerID, Model.ID.make("brawl-code"))
          expect(model?.variants.map((variant) => String(variant.id))).toContain("1M")
          expect(yield* models.get(providerID, Model.ID.make("brawl-code-next"))).toBeDefined()
          expect(yield* models.default()).toMatchObject({ providerID, id: "brawl-code" })
          expect(model?.headers).toMatchObject({ "X-Brawl-Tools": "visible" })
          const images = yield* models.available(["image"])
          expect(images.map((item) => [item.providerID, item.id, item.type, item.name, item.package])).toEqual([
            [providerID, "brawl-image", "image", "Brawl Image", "@opencode/ai/providers/openai-compatible/images"],
          ])
          expect(requests).toContain("GET /.well-known/opencode")
        }),
      ({ server }) => Effect.promise(() => server.stop(true)),
    ),
  )

  it.live("fails a declined sign-in without saving anything", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => site(() => Response.json({ error: "access_denied" }, { status: 400 }))),
      ({ server }) =>
        Effect.gen(function* () {
          yield* addPlugin()
          const integrations = yield* Integration.Service
          const attempt = yield* integrations.oauth.connect({
            integrationID,
            methodID: browser,
            answer: { site: server.url.origin, api: `${server.url.origin}/v1` },
          })
          const status = yield* eventually(
            integrations.oauth.status({ integrationID, attemptID: attempt.attemptID }),
            (value) => value.status !== "pending",
          )
          expect(status).toMatchObject({ status: "failed", message: "The sign-in was declined on the site" })
          const credentials = yield* Credential.Service
          expect(yield* credentials.list(integrationID)).toEqual([])
        }),
      ({ server }) => Effect.promise(() => server.stop(true)),
    ),
  )

  it.live("keeps the built-in models when the site cannot be reached", () =>
    Effect.gen(function* () {
      yield* addPlugin()
      const integrations = yield* Integration.Service
      yield* integrations.connection.key({
        integrationID,
        key: "brawl_sk_test",
        answer: { site: "http://127.0.0.1:9", api: "http://127.0.0.1:9/v1" },
      })
      const providers = yield* Provider.Service
      const provider = yield* eventually(providers.get(providerID), (value) => value !== undefined)
      expect(provider?.settings?.baseURL).toBe("http://127.0.0.1:9/v1")
      const models = yield* Model.Service
      expect(yield* models.get(providerID, Model.ID.make("brawl-code"))).toBeDefined()
      expect(yield* models.get(providerID, Model.ID.make("brawl-code-next"))).toBeUndefined()
    }),
  )
})
