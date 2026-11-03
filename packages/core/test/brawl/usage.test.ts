import { expect } from "bun:test"
import { Credential } from "@opencode/core/credential"
import { Integration } from "@opencode/core/integration"
import { UsageLimits } from "@opencode/core/usage-limits"
import { Effect, Exit, Layer } from "effect"
import { HttpClient, type HttpClientRequest, HttpClientResponse } from "effect/http"
import { testEffect } from "../lib/effect"

const it = testEffect(Layer.empty)

const unused = () => Effect.die("unused")

const signedIn = Credential.OAuth.make({
  type: "oauth",
  methodID: Integration.MethodID.make("browser"),
  access: "brawl_sk_test",
  refresh: "",
  expires: Number.MAX_SAFE_INTEGER,
  metadata: { site: "http://site.test", api: "http://api.test/v1", email: "anna@example.com" },
})

const read = (
  credential: Credential.Value | undefined,
  respond: (url: string) => Response,
  requests: HttpClientRequest.HttpClientRequest[] = [],
) =>
  Effect.flatMap(UsageLimits.Service, (limits) => limits.get()).pipe(
    Effect.provide(
      UsageLimits.layer.pipe(
        Layer.provide(
          Layer.merge(
            Layer.mock(Integration.Service, {
              revision: () => 0,
              get: unused,
              connection: {
                active: (id) =>
                  Effect.succeed(
                    id === "brawl" && credential
                      ? {
                          type: "credential" as const,
                          id: Credential.ID.make("brawl"),
                          label: "anna@example.com",
                          method: "oauth" as const,
                        }
                      : undefined,
                  ),
                resolve: () => Effect.succeed(credential),
                key: unused,
                external: unused,
                activate: unused,
                update: unused,
                remove: unused,
                status: unused,
              },
              oauth: { connect: unused, status: unused, complete: unused, cancel: unused },
              command: { connect: unused, status: unused, cancel: unused },
            }),
            Layer.succeed(
              HttpClient.HttpClient,
              HttpClient.make((request: HttpClientRequest.HttpClientRequest) =>
                Effect.sync(() => {
                  requests.push(request)
                  return HttpClientResponse.fromWeb(request, respond(request.url))
                }),
              ),
            ),
          ),
        ),
      ),
    ),
  )

const account = (limits: unknown) => ({
  object: "account",
  email: "anna@example.com",
  plan: "beta",
  limits,
  models: [{ id: "brawl-code", name: "Brawl Code 1.0 · Default (262K)" }],
})

it.effect("reads the Brawl account of the key the location signed in with", () =>
  Effect.gen(function* () {
    const requests: HttpClientRequest.HttpClientRequest[] = []
    const limits = yield* read(
      signedIn,
      () =>
        Response.json(
          account({
            concurrent: 1,
            windows: [{ id: "5h", used_percent: 112, limited: true, resets_at: "2026-11-03T22:00:00Z" }],
          }),
        ),
      requests,
    )

    expect(limits).toEqual({
      workspace: { id: "brawl", name: "anna@example.com", usageURL: "http://site.test/app/usage" },
      budgets: [],
      brawl: {
        email: "anna@example.com",
        plan: "beta",
        concurrent: 1,
        windows: [{ id: "5h", percent: 100, limited: true, resetsAt: Date.parse("2026-11-03T22:00:00Z") }],
        usageURL: "http://site.test/app/usage",
      },
    })
    expect(requests.map((request) => request.url)).toEqual(["http://api.test/v1/account"])
    expect(requests[0]?.headers.authorization).toBe("Bearer brawl_sk_test")
  }),
)

it.effect("a key without an account or a cap, and the beta's empty limits", () =>
  Effect.gen(function* () {
    const key = Credential.Key.make({ type: "key", key: "owner" })
    const limits = yield* read(key, () => Response.json({ ...account({ concurrent: null, windows: [] }), email: null }))
    expect(limits?.workspace).toEqual({ id: "brawl", usageURL: "https://brawl.io/app/usage" })
    expect(limits?.brawl).toEqual({ plan: "beta", windows: [], usageURL: "https://brawl.io/app/usage" })

    const old = yield* read(key, () => Response.json(account(null)))
    expect(old?.brawl?.windows).toEqual([])
  }),
)

it.effect("nothing without a Brawl connection or for a revoked key; an outage is an error", () =>
  Effect.gen(function* () {
    expect(yield* read(undefined, () => Response.json(account(null)))).toBeUndefined()
    expect(yield* read(signedIn, () => new Response("", { status: 401 }))).toBeUndefined()
    const down = yield* read(signedIn, () => new Response("", { status: 502 })).pipe(Effect.exit)
    expect(Exit.isFailure(down)).toBe(true)
  }),
)
