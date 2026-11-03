import type { Spot } from "./localize"

export const spots: readonly Spot[] = [
  {
    file: /routes[/\\]home\.tsx$/,
    strings: ["Fix a TODO in the codebase", "What is the tech stack of this project?", "Fix broken tests"],
  },
  {
    file: /component[/\\]dialog-integration\.tsx$/,
    strings: ["Popular", "Services", "copy code", "copy link"],
    expressions: ["props.method.label", "method.label", "props.attempt.instructions"],
  },
  { file: /context[/\\]local\.tsx$/, strings: ["Connect a provider", "No provider selected"] },
  { file: /routes[/\\]session[/\\]form\.tsx$/, strings: ["I finished", "open link"] },
  { file: /ui[/\\]dialog-select\.tsx$/, strings: ["Search"] },
  { file: /component[/\\]prompt[/\\]autocomplete\.tsx$/, strings: ["No matching commands"] },
  { file: /routes[/\\]session[/\\]permission\.tsx$/, strings: ["minimize", "fullscreen"] },
  { file: /util[/\\]permission\.ts$/, strings: ["Reject", "Confirm", "Cancel"] },
  { file: /mini[/\\]footer\.permission\.tsx$/, strings: ["Reject", "Permission", "Waiting…"] },
  { file: /routes[/\\]session[/\\]group-view\.tsx$/, strings: ["Thought", "Thinking", "Explored", "Exploring"] },
  { file: /component[/\\]dialog-session-list\.tsx$/, strings: ["current directory", "all projects"] },
  { file: /util[/\\]error\.ts$/, strings: ["Did you mean: ", "Try: `brawl-code models` to list available models"] },
]
