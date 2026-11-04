import { Option, Schema } from "effect"
import type { SessionMessageInfo } from "@opencode/client/promise"

const Status = Schema.Literals(["pending", "in_progress", "completed", "cancelled"])

export type TodoStatus = typeof Status.Type

export type Todo = {
  content: string
  status: TodoStatus
}

const Input = Schema.Struct({ todos: Schema.Array(Schema.Unknown) })

const Item = Schema.Struct({ content: Schema.String, status: Schema.optional(Schema.Unknown) })

const isStatus = Schema.is(Status)

export function planTodos(messages: readonly SessionMessageInfo[], boundary?: string): Todo[] {
  const end = boundary ? messages.findIndex((message) => message.id === boundary) : -1

  const call = messages
    .slice(0, end === -1 ? messages.length : end)
    .flatMap((message) => (message.type === "assistant" ? message.content : []))
    .findLast((item) => item.type === "tool" && item.name === "todowrite" && item.state.status === "completed")

  if (call?.type !== "tool" || call.state.status !== "completed") return []

  const input = Schema.decodeUnknownOption(Input)(call.state.input)

  if (Option.isNone(input)) return []

  return input.value.todos.flatMap((value) => {
    const item = Schema.decodeUnknownOption(Item)(value)

    if (Option.isNone(item) || !item.value.content) return []

    return [{ content: item.value.content, status: isStatus(item.value.status) ? item.value.status : "pending" }]
  })
}

export const finishedCount = (todos: readonly Todo[]) =>
  todos.filter((todo) => todo.status === "completed" || todo.status === "cancelled").length

export function currentIndex(todos: readonly Todo[]) {
  const working = todos.findIndex((todo) => todo.status === "in_progress")

  return working === -1 ? todos.findIndex((todo) => todo.status === "pending") : working
}
