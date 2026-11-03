export interface Spot {
  readonly file: RegExp
  readonly strings?: readonly string[]
  readonly expressions?: readonly string[]
}

type Dictionary = Readonly<Record<string, string>>

const props = "title|titlePlaceholder|placeholder|message|description|label|subtitle|category|hint|closeLabel"
const fresh = "(?<!__brawl_t\\()"

export function isPhrase(key: string) {
  return /^[A-Z][\w'’/+-]*(?: \S+)+$/.test(key) && !/\{\d+\}|["\n\\`]/.test(key)
}

const compiled = new WeakMap<Dictionary, ReturnType<typeof compile>>()

function compile(dictionary: Dictionary) {
  const alternation = (keys: string[]) =>
    keys
      .toSorted((a, b) => b.length - a.length)
      .map(escape)
      .join("|")
  const keys = Object.keys(dictionary).filter((key) => !/\{\d+\}|["\n\\`]/.test(key))
  const all = alternation(keys)
  const phrases = alternation(keys.filter(isPhrase))
  return {
    text: new RegExp(`(?<=[\\w}"'])(>\\s*)(${all})(\\s*[<{])`, "g"),
    tail: new RegExp(`(?<=\\})([ \\t]*)(${all})([ \\t]*<)`, "g"),
    attribute: new RegExp(`\\b(${props})="(${all})"`, "g"),
    property: new RegExp(`\\b(${props}):(\\s*)"(${all})"`, "g"),
    phrase: phrases
      ? new RegExp(
          `(?<![=!]==\\s*|\\bcase\\s+|\\bimport\\b[^\\n]*|\\bfrom\\s+|__brawl_t\\()(\\w=)?"(${phrases})"(?![:\\w]|\\s*[!=]==)`,
          "g",
        )
      : undefined,
  }
}

export function localize(code: string, file: string, dictionary: Dictionary, spots: readonly Spot[], module: string) {
  const rules = compiled.get(dictionary) ?? compiled.set(dictionary, compile(dictionary)).get(dictionary)!
  let changed = false
  const call = (key: string) => {
    changed = true
    return `__brawl_t(${JSON.stringify(key)})`
  }

  let out = code
    .replace(rules.text, (_, before: string, key: string, after: string) => `${before}{${call(key)}}${after}`)
    .replace(rules.tail, (_, before: string, key: string, after: string) => `${before}{${call(key)}}${after}`)
    .replace(rules.attribute, (_, prop: string, key: string) => `${prop}={${call(key)}}`)
    .replace(rules.property, (_, prop: string, space: string, key: string) => `${prop}:${space}${call(key)}`)
  if (rules.phrase)
    out = out.replace(rules.phrase, (_, attribute: string | undefined, key: string) =>
      attribute ? `${attribute}{${call(key)}}` : call(key),
    )

  for (const spot of spots) {
    if (!spot.file.test(file)) continue
    for (const key of spot.strings ?? [])
      out = out.replace(new RegExp(`${fresh}"${escape(key)}"`, "g"), () => call(key))
    for (const expression of spot.expressions ?? [])
      out = out.replace(new RegExp(`(?<![\\w.$]|__brawl_t\\()${escape(expression)}(?![\\w$.(])`, "g"), () => {
        changed = true
        return `__brawl_t(${expression})`
      })
  }

  out = out.replace(/`([^`$\\]*(?:\$\{[^{}`]*\}[^`$\\]*)+)`/g, (whole, body: string) => {
    const values: string[] = []
    const shape = body.replace(/\$\{([^{}`]*)\}/g, (_, value: string) => `{${values.push(value) - 1}}`)
    if (!(shape in dictionary)) return whole
    changed = true
    return `__brawl_tf(${[JSON.stringify(shape), ...values].join(", ")})`
  })

  if (!changed) return code
  return `import { t as __brawl_t, tf as __brawl_tf } from ${JSON.stringify(module)}\n${out}`
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
}
