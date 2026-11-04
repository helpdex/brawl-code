export const app = "brawl-code"
export const command = "brawl-code"
export const name = "Brawl Code"
export const id = "brawl"

export const models = {
  main: "brawl-code",
  private: "brawl-code-private",
  oneM: "brawl-code-1m",
  free: "brawl-code-free",
} as const

export const site = trim(process.env.BRAWL_SITE_URL || "https://brawl.io")
export const api = trim(process.env.BRAWL_API_URL || "https://llm.brawl.io/v1")

function trim(url: string) {
  return url.replace(/\/+$/, "")
}

export * as Brawl from "./brawl.js"
