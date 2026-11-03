export * as BrawlTools from "./tools.js"

import { ToolFailure } from "@opencode/ai/effect"
import type { Context } from "@opencode/plugin/effect/plugin"
import { Brawl } from "@opencode/util/brawl"
import { Duration, Effect, Option, Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http"
import { App } from "../app.js"
import { Permission } from "../permission.js"

export const providerID = "brawl"
export const docsName = "docs"
const searchTimeout = Duration.seconds(30)
const docsTimeout = Duration.seconds(40)

export const docsDescription = [
  "Searches the current official documentation and code examples of programming libraries, frameworks, SDKs, APIs, databases and developer tools.",
  "Before you write, change or explain code that relies on one of them, look up what the code needs: which functions, options, imports and settings exist in the current version, how to set something up, what an error means.",
  "Ask exactly what the code needs, one topic per call. Code that uses only a language's standard library, and questions that are not about software, need no lookup.",
].join("\n")

export const DocsInput = Schema.Struct({
  query: Schema.String.check(Schema.isMinLength(1)).annotate({
    description:
      'What you need to know, as a specific question in English, e.g. "How do I stream a response body in chunks with Req?"',
  }),
  libraries: Schema.optionalKey(Schema.Array(Schema.String).check(Schema.isMaxLength(4))).annotate({
    description:
      'Names of the libraries, frameworks or tools the question is about, e.g. ["Next.js"] or ["Phoenix LiveView", "Ecto"]. Leave it out when unsure.',
  }),
  version: Schema.optionalKey(Schema.String).annotate({
    description: 'The version in use, when the project or the user states it, e.g. "15.4".',
  }),
})

const DocsOutput = Schema.Struct({ text: Schema.String })
const DocsAnswer = Schema.Struct({ text: Schema.String })
const SearchAnswer = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({
      url: Schema.String,
      title: Schema.optionalKey(Schema.String),
      content: Schema.optionalKey(Schema.String),
      published: Schema.optionalKey(Schema.String),
    }),
  ),
})
const ErrorAnswer = Schema.Struct({ error: Schema.Struct({ message: Schema.String }) })
const decodeError = Schema.decodeUnknownOption(Schema.fromJsonString(ErrorAnswer))

export class SignInRequired extends Schema.TaggedError<SignInRequired>()("BrawlTools.SignInRequired", {}) {
  override get message() {
    return `Sign in to Brawl first: /connect, then Brawl`
  }
}

export const Plugin = {
  id: "brawl.tools",
  effect: Effect.fn("BrawlTools.Plugin")(function* (ctx: Context) {
    const http = yield* HttpClient.HttpClient
    const permission = yield* Permission.Service

    const account = Effect.fn("BrawlTools.account")(function* () {
      const connection = yield* ctx.integration.connection.active(Brawl.id)
      if (!connection) return yield* new SignInRequired()
      const credential = yield* ctx.integration.connection
        .resolve(connection)
        .pipe(Effect.orElseSucceed(() => undefined))
      if (!credential || credential.type === "external") return yield* new SignInRequired()
      const key = credential.type === "oauth" ? credential.access : credential.key
      const api = text(credential.metadata?.api) ?? Brawl.api
      return { key, api }
    })

    const post = <S extends Schema.Decoder<unknown>>(path: string, body: unknown, schema: S, timeout: Duration.Input) =>
      Effect.gen(function* () {
        const { key, api } = yield* account()
        const request = yield* HttpClientRequest.post(`${api}${path}`).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.bearerToken(key),
          HttpClientRequest.setHeaders({ "User-Agent": App.useragent(ctx.app) }),
          HttpClientRequest.bodyJson(body),
        )
        return yield* HttpClient.withScope(http)
          .execute(request)
          .pipe(
            Effect.flatMap((response) =>
              response.status === 200
                ? HttpClientResponse.schemaBodyJson(schema)(response)
                : response.text.pipe(
                    Effect.flatMap((detail) =>
                      Effect.fail(
                        new Error(
                          Option.match(decodeError(detail), {
                            onNone: () => `Brawl answered ${response.status}`,
                            onSome: (answer) => answer.error.message,
                          }),
                        ),
                      ),
                    ),
                  ),
            ),
            Effect.scoped,
            Effect.timeoutOrElse({
              duration: timeout,
              orElse: () => Effect.fail(new Error("Brawl did not answer in time")),
            }),
          )
      })

    yield* ctx.websearch.transform((editor) => {
      editor.add({
        id: providerID,
        name: "Brawl",
        execute: (input) =>
          post("/tools/web_search", { query: input.query }, SearchAnswer, searchTimeout).pipe(
            Effect.map((answer) =>
              answer.results.map((result) => {
                const published = result.published ? Date.parse(result.published) : Number.NaN
                return {
                  url: result.url,
                  ...(result.title ? { title: result.title } : {}),
                  ...(result.content ? { content: result.content } : {}),
                  time: Number.isFinite(published) ? { published } : {},
                }
              }),
            ),
          ),
      })
      editor.default.set(providerID)
    })

    yield* ctx.tool.transform((editor) =>
      editor.add({
        name: docsName,
        options: { codemode: false },
        description: docsDescription,
        input: DocsInput,
        output: DocsOutput,
        execute: (input, context) =>
          Effect.gen(function* () {
            yield* permission.assert({
              action: docsName,
              resources: [input.query],
              save: ["*"],
              metadata: input,
              sessionID: context.sessionID,
              agent: context.agent,
              source: { type: "tool", messageID: context.messageID, id: context.id },
            })
            const answer = yield* post("/tools/docs", input, DocsAnswer, docsTimeout).pipe(
              Effect.mapError(
                (error) => new ToolFailure({ message: `Unable to search the documentation: ${error.message}`, error }),
              ),
            )
            return { output: answer, content: answer.text, metadata: {} }
          }).pipe(
            Effect.mapError((error) =>
              error instanceof ToolFailure
                ? error
                : new ToolFailure({ message: "Unable to search the documentation", error }),
            ),
          ),
      }),
    )
  }),
}

function text(value: unknown) {
  return typeof value === "string" && value !== "" ? value : undefined
}
