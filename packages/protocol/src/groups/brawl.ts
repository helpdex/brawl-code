import { Location } from "@opencode/schema/location"
import { Model } from "@opencode/schema/model"
import { optional } from "@opencode/schema/schema"
import { Session } from "@opencode/schema/session"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api"
import { LocationQuery, locationQueryOpenApi } from "./location.js"
import { InvalidRequestError, LocationNotFoundError, ServiceUnavailableError, SessionNotFoundError } from "../errors.js"

const Files = Schema.Struct({ files: Schema.Array(Schema.String) })

export const BrawlCommit = Schema.Struct({
  hash: Schema.String,
  branch: optional(Schema.String),
  pushed: Schema.Boolean,
  pushError: optional(Schema.String),
}).annotate({ identifier: "BrawlCommit" })

export const BrawlGroup = HttpApiGroup.make("server.brawl")
  .add(
    HttpApiEndpoint.post("brawl.git.commit", "/api/brawl/git/commit", {
      query: LocationQuery,
      payload: Schema.Struct({ message: Schema.String, push: Schema.Boolean }),
      success: Location.response(BrawlCommit),
      error: [InvalidRequestError, ServiceUnavailableError],
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "brawl.git.commit",
          summary: "Commit all changes",
          description:
            "Stage every uncommitted change under the location and commit it. With push, also push the branch, publishing it to origin when it has no upstream; a failed push keeps the commit and returns pushError.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.post("brawl.git.message", "/api/brawl/git/message", {
      query: LocationQuery,
      payload: Schema.Struct({ model: Model.Ref.pipe(Schema.optional), sessionID: Session.ID.pipe(Schema.optional) }),
      success: Location.response(Schema.Struct({ message: Schema.String })),
      error: [InvalidRequestError, ServiceUnavailableError],
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "brawl.git.message",
          summary: "Write a commit message",
          description:
            "Ask the model for a commit message from the uncommitted diff, recent commit subjects and the session title.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.post("brawl.git.discard", "/api/brawl/git/discard", {
      query: LocationQuery,
      payload: Files,
      success: Location.response(Files),
      error: [InvalidRequestError, ServiceUnavailableError],
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "brawl.git.discard",
          summary: "Discard uncommitted changes",
          description:
            "Restore the listed files to HEAD and delete the listed new files. Only paths with uncommitted changes are touched; a path ending in / covers the changed files under it.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.post("brawl.session.discard", "/api/brawl/session/:sessionID/discard", {
      params: { sessionID: Session.ID },
      query: LocationQuery,
      payload: Files,
      success: Location.response(Files),
      error: [InvalidRequestError, ServiceUnavailableError, SessionNotFoundError, LocationNotFoundError],
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "brawl.session.discard",
          summary: "Discard the last turn's changes",
          description:
            "Restore the listed files to the snapshot taken when the session's newest turn started, keeping the conversation.",
        }),
      ),
  )
  .annotateMerge(OpenApi.annotations({ title: "brawl", description: "Brawl Code routes for the Changes pane." }))
