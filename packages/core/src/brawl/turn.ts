export * as BrawlTurn from "./turn.js"

import { Context, Effect } from "effect"
import { Database } from "../database/database.js"
import { LocationServiceMap } from "../location-service-map.js"
import { RelativePath } from "../schema.js"
import { SessionDiff } from "../session/diff.js"
import { SessionSchema } from "../session/schema.js"
import { Snapshot } from "../snapshot.js"

export const discard = Effect.fn("BrawlTurn.discard")(function* (
  db: Database.Interface["db"],
  locations: Context.Service.Shape<typeof LocationServiceMap.Service>,
  input: { readonly session: SessionSchema.Info; readonly files: readonly string[] },
) {
  const found = yield* SessionDiff.range(db, { session: input.session })
  if (!found) return []
  const from = Snapshot.ID.make(found.from)
  return yield* Effect.gen(function* () {
    const snapshot = yield* Snapshot.Service
    const now = yield* snapshot.capture()
    if (!now) return []
    const changed = yield* snapshot.files({ from, to: now })
    const wanted = new Set(input.files)
    const folders = input.files.filter((file) => file.endsWith("/"))
    const files = changed.filter((file) => wanted.has(file) || folders.some((folder) => file.startsWith(folder)))
    if (files.length === 0) return []
    yield* snapshot.restore({ files: new Map(files.map((file) => [RelativePath.make(file), from])) })
    return files as readonly string[]
  }).pipe(Effect.provide(locations.get(found.location)))
})
