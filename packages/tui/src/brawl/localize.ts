export interface Spot {
  readonly file: RegExp
  readonly strings: readonly string[]
}

const props = "title|titlePlaceholder|placeholder|message|description|label|subtitle|category|hint|closeLabel"

export function localize(
  code: string,
  file: string,
  dictionary: Readonly<Record<string, string>>,
  spots: readonly Spot[],
  module: string,
) {
  let out = code
  let changed = false
  const call = (key: string) => {
    changed = true
    return `__brawl_t(${JSON.stringify(key)})`
  }
  const keys = Object.keys(dictionary)
    .filter((key) => !/\{\d+\}|["\n\\`]/.test(key))
    .toSorted((a, b) => b.length - a.length)

  for (const key of keys) {
    const text = escape(key)
    out = out
      .replace(new RegExp(`(>[ \\t]*)${text}([ \\t]*<)`, "g"), (_, before: string, after: string) => {
        return `${before}{${call(key)}}${after}`
      })
      .replace(new RegExp(`\\b(${props})="${text}"`, "g"), (_, prop: string) => `${prop}={${call(key)}}`)
      .replace(new RegExp(`\\b(${props}):(\\s*)"${text}"`, "g"), (_, prop: string, space: string) => {
        return `${prop}:${space}${call(key)}`
      })
  }

  for (const spot of spots)
    if (spot.file.test(file))
      for (const key of spot.strings) out = out.replace(new RegExp(`"${escape(key)}"`, "g"), () => call(key))

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
