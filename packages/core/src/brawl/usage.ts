export * as BrawlUsage from "./usage.js"

import { UsageLimits } from "@opencode/schema/usage-limits"
import { Brawl } from "@opencode/util/brawl"
import { Effect, Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http"
import { Integration } from "../integration.js"

const Window = Schema.Struct({
  id: Schema.String,
  used_percent: Schema.Finite,
  limited: Schema.Boolean,
  resets_at: Schema.DateFromString,
})
const Account = Schema.Struct({
  email: Schema.NullOr(Schema.String),
  plan: Schema.String,
  limits: Schema.NullOr(Schema.Struct({ concurrent: Schema.NullOr(Schema.Finite), windows: Schema.Array(Window) })),
})

export const get = Effect.fn("BrawlUsage.get")(function* (
  integrations: Integration.Interface,
  http: HttpClient.HttpClient,
) {
  const connection = yield* integrations.connection.active(Integration.ID.make(Brawl.id))
  if (!connection) return undefined
  const credential = yield* integrations.connection.resolve(connection).pipe(Effect.orElseSucceed(() => undefined))
  if (!credential || credential.type === "external") return undefined
  const key = credential.type === "oauth" ? credential.access : credential.key
  const site = text(credential.metadata?.site) ?? Brawl.site
  const api = text(credential.metadata?.api) ?? Brawl.api
  const account = yield* HttpClient.withScope(http)
    .execute(
      HttpClientRequest.get(`${api}/account`).pipe(HttpClientRequest.acceptJson, HttpClientRequest.bearerToken(key)),
    )
    .pipe(
      Effect.flatMap((response) =>
        response.status === 401
          ? Effect.succeed(undefined)
          : HttpClientResponse.filterStatusOk(response).pipe(
              Effect.flatMap(HttpClientResponse.schemaBodyJson(Account)),
            ),
      ),
      Effect.scoped,
      Effect.mapError((error) => new Error(`The Brawl account is unavailable: ${error.message}`)),
    )
  if (!account) return undefined
  return info(account, site)
})

function info(account: typeof Account.Type, site: string): UsageLimits.Info {
  const concurrent = account.limits?.concurrent
  return {
    workspace: { id: Brawl.id, ...(account.email ? { name: account.email } : {}), usageURL: `${site}/app/usage` },
    budgets: [],
    brawl: {
      ...(account.email ? { email: account.email } : {}),
      plan: account.plan,
      ...(typeof concurrent === "number" ? { concurrent } : {}),
      windows: (account.limits?.windows ?? []).map((window) => ({
        id: window.id,
        percent: Math.min(100, Math.max(0, window.used_percent)),
        limited: window.limited,
        resetsAt: window.resets_at.getTime(),
      })),
      usageURL: `${site}/app/usage`,
    },
  }
}

function text(value: unknown) {
  return typeof value === "string" && value !== "" ? value : undefined
}
