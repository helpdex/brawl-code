import { app } from "electron"

type Channel = "local" | "dev" | "beta" | "prod"

const raw = import.meta.env.OPENCODE_CHANNEL

export const CHANNEL: Channel = raw === "local" || raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

export const VERSION = app.isPackaged ? app.getVersion() : (process.env.OPENCODE_VERSION ?? app.getVersion())

const appNames: Record<string, string> = {
  dev: "Brawl Code Dev",
  beta: "Brawl Code Beta",
  prod: "Brawl Code",
}

const appIDs: Record<string, string> = {
  dev: "io.brawl.code.dev",
  beta: "io.brawl.code.beta",
  prod: "io.brawl.code",
}

// Local renderer/server mode keeps the dev application identity.
export const APP_NAME = app.isPackaged ? appNames[CHANNEL] : "Brawl Code Dev"

export const APP_ID = app.isPackaged ? appIDs[CHANNEL] : "io.brawl.code.dev"
