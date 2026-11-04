export * as BrawlPlugin from "./plugin.js"

import { execFileSync } from "node:child_process"
import os from "node:os"
import { Clock, Duration, Effect, FiberHandle, Option, Schema, Scope, Stream } from "effect"
import type { IntegrationOAuthMethodRegistration } from "@opencode/plugin/effect/integration"
import { define } from "@opencode/plugin/effect/plugin"
import type { Form } from "@opencode/schema/form"
import { Brawl } from "@opencode/util/brawl"
import { App } from "../app.js"
import { Bus } from "../bus.js"
import { Config } from "../config.js"
import { ConfigIntegration } from "../config/integration.js"
import { ConfigProviderPlugin } from "../config/plugin/provider.js"
import { Credential } from "../credential.js"
import { Integration } from "../integration.js"

const integrationID = Integration.ID.make(Brawl.id)
const account = "Brawl"
const methodID = Integration.MethodID.make("browser")
const deviceGrant = "urn:ietf:params:oauth:grant-type:device_code"
const never = Number.MAX_SAFE_INTEGER
const requestTimeout = Duration.seconds(15)
const refreshInterval = Duration.minutes(10)

const Device = Schema.Struct({
  device_code: Schema.String,
  user_code: Schema.String,
  verification_uri: Schema.String,
  verification_uri_complete: Schema.String,
  expires_in: Schema.Number,
  interval: Schema.Number,
})
type Device = typeof Device.Type
const Token = Schema.Struct({ access_token: Schema.String })
const TokenError = Schema.Struct({ error: Schema.String })
const decodeTokenError = Schema.decodeUnknownOption(Schema.fromJsonString(TokenError))
const Account = Schema.Struct({
  email: Schema.NullOr(Schema.String),
  models: Schema.optional(Schema.Array(Schema.Struct({ id: Schema.String }))),
})
const Manifest = Schema.Struct({
  config: Schema.Struct({
    providers: Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Unknown)),
  }),
})

const addresses: Form.Fields = [
  { key: "site", type: "string", format: "uri", hidden: true, default: Brawl.site },
  { key: "api", type: "string", format: "uri", hidden: true, default: Brawl.api },
]

export const fallback = {
  [Brawl.id]: {
    package: "@opencode/ai/providers/openai-compatible",
    models: {
      "brawl-code": {
        name: "Brawl Code 1.0",
        capabilities: { reasoning: { supported: true } },
        limit: { context: 1048576, output: 32768 },
        variants: [{ id: "1M", body: { model: "brawl-code-1m" } }],
      },
    },
  },
}

export const Plugin = define<Bus.Service | Config.Service | Scope.Scope>({
  id: "brawl.provider",
  effect: Effect.fn(function* (ctx) {
    const bus = yield* Bus.Service
    const config = yield* Config.Service
    type ActiveConnection = Effect.Success<ReturnType<typeof ctx.integration.connection.active>>
    let snapshot: { connection: ActiveConnection; remote: ConfigIntegration.Remote | undefined } = {
      connection: undefined,
      remote: undefined,
    }
    let integrated: ConfigIntegration.Document | undefined

    const load = Effect.fn("BrawlPlugin.load")(function* () {
      const connection = yield* ctx.integration.connection.active(Brawl.id)
      if (!connection) return { connection, remote: undefined }
      const credential = yield* ctx.integration.connection
        .resolve(connection)
        .pipe(Effect.orElseSucceed(() => undefined))
      const site = text(credential?.metadata?.site) ?? Brawl.site
      const api = text(credential?.metadata?.api) ?? Brawl.api
      const key =
        credential?.type === "oauth" ? credential.access : credential?.type === "key" ? credential.key : undefined
      const owned = key ? yield* accountModels(api, key, ctx.app) : undefined
      const loaded = yield* manifest(site, api, owned, ctx.app).pipe(
        Effect.catch((cause) =>
          Effect.logWarning("failed to load the Brawl provider config", { site, cause }).pipe(
            Effect.andThen(
              snapshot.remote
                ? Effect.succeed(snapshot.remote)
                : remote(tiers(fallback, owned), api).pipe(Effect.orDie),
            ),
          ),
        ),
      )
      return { connection, remote: loaded }
    })
    const publish = Effect.fnUntraced(function* (next: typeof snapshot) {
      yield* config.integration?.(
        integrationID,
        next.connection && next.remote
          ? ConfigIntegration.make({
              integrationID,
              connection:
                next.connection.type === "credential"
                  ? { ...next.connection, id: Credential.ID.make(next.connection.id) }
                  : next.connection,
              info: next.remote,
            })
          : undefined,
      ) ?? Effect.void
      integrated = (yield* config.entries()).find(
        (entry): entry is ConfigIntegration.Document =>
          entry instanceof ConfigIntegration.Document && entry.integrationID === integrationID,
      )
    })
    const refresh = Effect.fn("BrawlPlugin.refresh")(function* () {
      const next = yield* load()
      if (JSON.stringify(next) === JSON.stringify(snapshot)) return
      snapshot = next
      yield* publish(next)
      yield* ctx.provider.reload()
    })

    yield* ctx.integration.transform((editor) => {
      editor.remove("opencode")
      editor.remove("opencode-go")
      editor.update(Brawl.id, (integration) => {
        integration.name = account
      })
      editor.method.update(browser(ctx.app))
      editor.method.update({
        integrationID: Brawl.id,
        method: { type: "key", label: "Brawl API key (brawl_sk_…)", form: addresses },
      })
      editor.method.update({ integrationID: Brawl.id, method: { type: "env", names: ["BRAWL_API_KEY"] } })
    })

    snapshot = yield* load()
    yield* publish(snapshot)
    yield* ctx.provider.transform((providers) => {
      providers.remove("opencode")
      providers.remove("opencode-go")
      if (integrated) ConfigProviderPlugin.integrate(providers, integrated)
    })
    yield* ctx.model.transform((models) => {
      const modelID = Object.keys(integrated?.info.providers?.[Brawl.id]?.models ?? {})[0]
      if (!modelID || models.default.get() || !models.get(Brawl.id, modelID)) return
      models.default.set(Brawl.id, modelID)
    })

    const timer = yield* FiberHandle.make<void, never>()
    const keepFresh = Effect.fnUntraced(function* () {
      if (!snapshot.connection) return yield* FiberHandle.clear(timer)
      yield* FiberHandle.run(timer, Effect.sleep(refreshInterval).pipe(Effect.andThen(refresh()), Effect.forever), {
        onlyIfMissing: true,
      })
    })
    yield* bus.subscribe(Credential.Event.Switched).pipe(
      Stream.filter((event) => event.data.integrationID === integrationID),
      Stream.runForEach(() => refresh().pipe(Effect.andThen(keepFresh()))),
      Effect.forkScoped({ startImmediately: true }),
    )
    yield* keepFresh()
  }),
})

function browser(app: App.Info) {
  return {
    integrationID: Brawl.id,
    method: {
      id: methodID,
      type: "oauth",
      label: "Brawl account (sign in through the browser)",
      form: addresses,
    },
    authorize: (answer) =>
      Effect.gen(function* () {
        const site = yield* address(answer.site ?? Brawl.site)
        const api = yield* address(answer.api ?? Brawl.api)
        const params = yield* deviceParams()
        const device = yield* request(
          `${site}/api/device/code`,
          { method: "POST", headers: headers(app), body: new URLSearchParams(params).toString() },
          Device,
        )
        const created = yield* Clock.currentTimeMillis
        return {
          mode: "auto" as const,
          url: device.verification_uri_complete,
          instructions: `Check that ${new URL(device.verification_uri).host} shows ${device.user_code} and press Connect`,
          expiresAt: created + device.expires_in * 1000,
          callback: poll(site, device, app).pipe(Effect.flatMap((key) => credential(site, api, key, app))),
        }
      }),
    label: (credential) => (typeof credential.metadata?.email === "string" ? credential.metadata.email : undefined),
  } satisfies IntegrationOAuthMethodRegistration
}

function poll(site: string, device: Device, app: App.Info) {
  const loop = (interval: number): Effect.Effect<string, Error> =>
    Effect.gen(function* () {
      yield* Effect.sleep(Duration.seconds(interval))
      const response = yield* send(`${site}/api/device/token`, {
        method: "POST",
        headers: headers(app),
        body: new URLSearchParams({ grant_type: deviceGrant, device_code: device.device_code }).toString(),
      }).pipe(Effect.option)
      if (Option.isNone(response)) return yield* loop(interval)
      if (response.value.ok) return (yield* decode(response.value, Token)).access_token
      const body = yield* Effect.promise(() => response.value.text())
      const error = Option.getOrUndefined(decodeTokenError(body))?.error
      if (error === "authorization_pending") return yield* loop(interval)
      if (error === "slow_down") return yield* loop(interval + 5)
      if (error === "access_denied") return yield* Effect.fail(new Error("The sign-in was declined on the site"))
      if (error === "expired_token") return yield* Effect.fail(new Error("The code expired; sign in again"))
      return yield* Effect.fail(
        new Error(`The site refused the sign-in (${response.value.status}${error ? `: ${error}` : ""})`),
      )
    })
  return loop(device.interval)
}

function credential(site: string, api: string, key: string, app: App.Info) {
  return request(`${api}/account`, { headers: { ...headers(app), Authorization: `Bearer ${key}` } }, Account).pipe(
    Effect.map((account) => account.email),
    Effect.orElseSucceed(() => null),
    Effect.map((email) =>
      Credential.OAuth.make({
        type: "oauth",
        methodID,
        access: key,
        refresh: "",
        expires: never,
        metadata: email ? { site, api, email } : { site, api },
      }),
    ),
  )
}

function manifest(site: string, api: string, owned: ReadonlyArray<string> | undefined, app: App.Info) {
  return request(`${site}/.well-known/opencode`, { headers: headers(app) }, Manifest).pipe(
    Effect.flatMap((value) => remote(tiers(value.config.providers, owned), api)),
  )
}

function accountModels(api: string, key: string, app: App.Info) {
  return request(`${api}/account`, { headers: { ...headers(app), Authorization: `Bearer ${key}` } }, Account).pipe(
    Effect.map((account) => account.models?.map((model) => model.id)),
    Effect.orElseSucceed(() => undefined),
  )
}

export function tiers(
  providers: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
  owned: ReadonlyArray<string> | undefined,
) {
  const brawl = providers[Brawl.id]
  const hasPrivate = owned?.includes(Brawl.models.private) ?? false
  if (!brawl || !owned?.includes(Brawl.models.free)) return providers
  const site = isRecord(brawl.models) ? Object.values(brawl.models).find(isRecord) : undefined
  const output = isRecord(site?.limit) && typeof site.limit.output === "number" ? site.limit.output : 32768
  const base = { capabilities: site?.capabilities ?? { reasoning: { supported: true } } }
  const oneM = owned.includes(Brawl.models.oneM)
  const models: Record<string, unknown> = {}
  if (hasPrivate)
    models[Brawl.models.main] = {
      ...base,
      name: "Brawl Code 1.0 Private",
      limit: { context: oneM ? 1048576 : 262144, output },
      ...(oneM ? { variants: [{ id: "1M", body: { model: Brawl.models.oneM } }] } : {}),
    }
  models[Brawl.models.free] = { ...base, name: "Brawl Code 1.0 Free", limit: { context: 1048576, output } }
  return { ...providers, [Brawl.id]: { ...brawl, models, images: hasPrivate } }
}

export const visibleTools = { "X-Brawl-Tools": "visible" }
export const imageModel = {
  name: "Brawl Image",
  type: "image",
  package: "@opencode/ai/providers/openai-compatible/images",
  capabilities: { tools: false, input: ["text"], output: ["image"] },
}

function remote(providers: Readonly<Record<string, Readonly<Record<string, unknown>>>>, api: string) {
  return Schema.decodeUnknownEffect(ConfigIntegration.Remote)({
    providers: Object.fromEntries(
      Object.entries(providers).map(([id, { images, ...provider }]) => [
        id,
        {
          ...provider,
          name: account,
          settings: { ...(isRecord(provider.settings) ? provider.settings : {}), baseURL: api },
          ...(id === Brawl.id
            ? {
                headers: { ...(isRecord(provider.headers) ? provider.headers : {}), ...visibleTools },
                models: {
                  ...(isRecord(provider.models) ? provider.models : {}),
                  ...(images === false ? {} : { "brawl-image": imageModel }),
                },
              }
            : {}),
        },
      ]),
    ),
  }).pipe(Effect.mapError((cause) => new Error("The site's provider config is not valid", { cause })))
}

function deviceParams() {
  return Effect.try({
    try: () => {
      if (process.platform === "darwin")
        return execFileSync("scutil", ["--get", "ComputerName"], { encoding: "utf8", timeout: 2000 }).trim()
      if (process.platform === "win32") return process.env.COMPUTERNAME ?? ""
      return ""
    },
    catch: (cause) => cause,
  }).pipe(
    Effect.orElseSucceed(() => ""),
    Effect.map((name) => ({ device_name: name || os.hostname(), client_id: Brawl.command })),
  )
}

function address(input: unknown) {
  return Effect.try({
    try: () => {
      if (typeof input !== "string") throw new Error("expected a string")
      const url = new URL(input)
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("expected HTTP(S)")
      return `${url.origin}${url.pathname.replace(/\/+$/, "")}`
    },
    catch: (cause) => new Error(`Invalid Brawl address: ${cause instanceof Error ? cause.message : String(cause)}`),
  })
}

function text(value: unknown) {
  return typeof value === "string" && value !== "" ? value : undefined
}

function request<S extends Schema.Decoder<unknown>>(url: string, init: RequestInit, schema: S) {
  return send(url, init).pipe(
    Effect.flatMap((response) => {
      if (response.ok) return decode(response, schema)
      return Effect.promise(() => response.text()).pipe(
        Effect.flatMap((detail) =>
          Effect.fail(new Error(`${url} answered ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`)),
        ),
      )
    }),
  )
}

function send(url: string, init: RequestInit) {
  return Effect.tryPromise({
    try: (signal) => fetch(url, { ...init, signal }),
    catch: (cause) => new Error(`Could not reach ${url}`, { cause }),
  }).pipe(Effect.timeoutOrElse({ duration: requestTimeout, orElse: () => Effect.fail(new Error(`${url} timed out`)) }))
}

function decode<S extends Schema.Decoder<unknown>>(response: Response, schema: S) {
  return Effect.tryPromise({
    try: () => response.json(),
    catch: (cause) => new Error(`${response.url} answered with invalid JSON`, { cause }),
  }).pipe(
    Effect.flatMap((body) => Schema.decodeUnknownEffect(schema)(body)),
    Effect.mapError((cause) => (cause instanceof Error ? cause : new Error(String(cause)))),
  )
}

function headers(app: App.Info) {
  return {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
    "User-Agent": App.useragent(app),
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
