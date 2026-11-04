import { BrawlGit } from "@opencode/core/brawl/git"
import { BrawlTurn } from "@opencode/core/brawl/turn"
import { Database } from "@opencode/core/database/database"
import { Generate } from "@opencode/core/generate"
import { Location } from "@opencode/core/location"
import { LocationServiceMap } from "@opencode/core/location-services"
import { Session } from "@opencode/core/session"
import { Vcs } from "@opencode/core/vcs"
import { InvalidRequestError, ServiceUnavailableError } from "@opencode/protocol/errors"
import { AppProcess } from "@opencode/util/process"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../api"
import { awaitPlugins, locationErrors, response } from "../location"
import { missingSession } from "./session-error"

const failed = (error: BrawlGit.Failure) => new InvalidRequestError({ message: error.message, kind: error.step })

export const BrawlHandler = HttpApiBuilder.group(Api, "server.brawl", (handlers) =>
  Effect.gen(function* () {
    const proc = yield* AppProcess.Service
    const sessions = yield* Session.Service
    const database = yield* Database.Service
    const locations = yield* LocationServiceMap.Service
    return handlers
      .handle("brawl.git.commit", (ctx) =>
        response(
          Effect.gen(function* () {
            const location = yield* Location.Service
            return yield* BrawlGit.commit(proc, location.directory, ctx.payload).pipe(Effect.mapError(failed))
          }),
        ),
      )
      .handle("brawl.git.message", (ctx) =>
        response(
          Effect.gen(function* () {
            yield* awaitPlugins
            const location = yield* Location.Service
            const title = ctx.payload.sessionID
              ? yield* sessions.get(ctx.payload.sessionID).pipe(
                  Effect.map((session) => session.title),
                  Effect.orElseSucceed(() => undefined),
                )
              : undefined
            const prompt = yield* BrawlGit.prompt(proc, location.directory, { title }).pipe(Effect.mapError(failed))
            const generate = yield* Generate.Service
            const text = yield* generate
              .text({ prompt, ...(ctx.payload.model ? { model: ctx.payload.model } : {}) })
              .pipe(
                Effect.mapError((error) => new ServiceUnavailableError({ message: error.message, service: "model" })),
              )
            const message = BrawlGit.message(text)
            if (!message)
              return yield* new ServiceUnavailableError({ message: "The model wrote no message", service: "model" })
            return { message }
          }),
        ),
      )
      .handle("brawl.git.discard", (ctx) =>
        response(
          Effect.gen(function* () {
            const location = yield* Location.Service
            const vcs = yield* Vcs.Service
            const status = yield* vcs.status()
            const files = yield* BrawlGit.discard(proc, {
              worktree: location.project.directory,
              files: ctx.payload.files,
              status,
            }).pipe(Effect.mapError(failed))
            return { files }
          }),
        ),
      )
      .handle("brawl.session.discard", (ctx) =>
        response(
          Effect.gen(function* () {
            const session = yield* sessions
              .get(ctx.params.sessionID)
              .pipe(Effect.catchTag("Session.NotFoundError", missingSession))
            const files = yield* BrawlTurn.discard(database.db, locations, { session, files: ctx.payload.files }).pipe(
              Effect.catchTag(
                ["Session.TurnRangeError", "Session.MessageNotFoundError"],
                (error) => new InvalidRequestError({ message: error.message }),
              ),
              Effect.catchTag("Snapshot.Error", (error) => new ServiceUnavailableError({ message: error.message })),
              locationErrors,
            )
            return { files }
          }),
        ),
      )
  }),
)
