import type { Spot } from "./localize"

export const spots: readonly Spot[] = [
  {
    file: /routes[/\\]home\.tsx$/,
    strings: ["Fix a TODO in the codebase", "What is the tech stack of this project?", "Fix broken tests"],
  },
  { file: /component[/\\]dialog-integration\.tsx$/, strings: ["Popular", "Services", "copy code", "copy link"] },
  { file: /context[/\\]local\.tsx$/, strings: ["Connect a provider", "No provider selected"] },
  { file: /routes[/\\]session[/\\]form\.tsx$/, strings: ["I finished", "open link"] },
  { file: /ui[/\\]dialog-select\.tsx$/, strings: ["Search"] },
  { file: /component[/\\]prompt[/\\]autocomplete\.tsx$/, strings: ["No matching commands"] },
]
