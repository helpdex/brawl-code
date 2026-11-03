const product = /OpenCode(?! (?:Go|Console|Zen|Free|V2)\b)/g

const command = /\bopencode (?=(?:pair|auth|serve|service|run|mcp|session|upgrade)\b)/g

const english = {
  "settings.about.description": "Brawl Code, the coding agent by Brawl",
  "settings.about.trademark":
    "Brawl Code is built on OpenCode (MIT). OpenCode is a registered trademark of Anomaly Innovations, Inc.",
  "command.provider.connect.description": "Sign in to Brawl or another model provider",
  "settings.about.website": "brawl.io",
  "settings.about.copyright": "© Brawl · OpenCode © Anomaly Innovations, Inc.",
  "error.page.report.discord": "at brawl.io",
  "dialog.provider.opencode.note": "Brawl Code 1.0 with 262K and 1M context",
}

const russian = {
  "settings.about.description": "Brawl Code — агент для программирования от Brawl",
  "settings.about.trademark":
    "Brawl Code построен на OpenCode (MIT). OpenCode — зарегистрированный товарный знак Anomaly Innovations, Inc.",
  "command.provider.connect.description": "Войти в Brawl или к другому поставщику моделей",
  "settings.about.website": "brawl.io",
  "settings.about.copyright": "© Brawl · OpenCode © Anomaly Innovations, Inc.",
  "error.page.report.discord": "на brawl.io",
  "dialog.provider.opencode.note": "Brawl Code 1.0 с контекстом 262K и 1M",
}

const wording = new Map<string, Readonly<Record<string, string>>>([
  ["en", english],
  ["ru", russian],
])

const required = [
  "settings.about.description",
  "settings.about.trademark",
  "settings.about.website",
  "settings.about.copyright",
  "error.page.report.discord",
  "dialog.provider.opencode.note",
] as const satisfies ReadonlyArray<keyof typeof english>

export function brand<Dictionary extends Readonly<Record<string, string>>>(
  locale: string,
  dictionary: Dictionary,
): Dictionary {
  const own: Readonly<Record<string, string>> =
    wording.get(locale) ?? Object.fromEntries(required.map((key) => [key, english[key]]))

  // SAFETY: the same keys, each still mapped to a string.
  return Object.fromEntries(
    Object.entries(dictionary).map(([key, value]) => [
      key,
      own[key] ?? value.replace(product, "Brawl Code").replace(command, "brawl-code "),
    ]),
  ) as Dictionary
}
