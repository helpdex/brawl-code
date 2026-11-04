import { describe, expect, test } from "bun:test"
import type { JsonValue, SessionMessageInfo } from "@opencode/client/promise"
import { currentIndex, finishedCount, planTodos, type Todo } from "./plan"
import { planText } from "./text"

const write = (id: string, todos: JsonValue[], running = false): SessionMessageInfo => ({
  id,
  type: "assistant",
  agent: "build",
  model: { id: "brawl-code", providerID: "brawl" },
  content: [
    {
      type: "tool",
      id: `tool_${id}`,
      name: "todowrite",
      state: running
        ? { status: "running", input: { todos }, metadata: {} }
        : { status: "completed", input: { todos }, content: [{ type: "text", text: "ok" }] },
      time: { created: 1 },
    },
  ],
  time: { created: 1 },
})

const user = (id: string): SessionMessageInfo => ({ id, type: "user", text: "go", time: { created: 1 } })

describe("planTodos", () => {
  test("reads the latest completed todowrite call", () => {
    const messages = [
      write("a", [{ content: "Old", status: "pending" }]),
      user("b"),
      write("c", [
        { content: "Read the code", status: "completed" },
        { content: "Write the module", status: "in_progress" },
        { content: "", status: "pending" },
        { content: "Tests", status: "unknown" },
      ]),
      write("d", [{ content: "Running", status: "pending" }], true),
    ]

    expect(planTodos(messages)).toEqual([
      { content: "Read the code", status: "completed" },
      { content: "Write the module", status: "in_progress" },
      { content: "Tests", status: "pending" },
    ])
  })

  test("stops at the revert boundary", () => {
    const messages = [write("a", [{ content: "First", status: "pending" }]), write("b", [{ content: "Second" }])]

    expect(planTodos(messages, "b")).toEqual([{ content: "First", status: "pending" }])
    expect(planTodos(messages, "a")).toEqual([])
    expect(planTodos([user("a")])).toEqual([])
  })
})

describe("progress", () => {
  const todos: Todo[] = [
    { content: "1", status: "completed" },
    { content: "2", status: "cancelled" },
    { content: "3", status: "pending" },
    { content: "4", status: "in_progress" },
  ]

  test("counts completed and cancelled as done, like the terminal", () => {
    expect(finishedCount(todos)).toBe(2)
  })

  test("the current item is the one in progress, else the next pending one", () => {
    expect(currentIndex(todos)).toBe(3)
    expect(currentIndex(todos.slice(0, 3))).toBe(2)
    expect(currentIndex(todos.slice(0, 2))).toBe(-1)
  })

  test("texts follow the interface language", () => {
    expect(planText("ru-RU").progress(3, 6)).toBe("3 из 6")
    expect(planText("de").progress(3, 6)).toBe("3 of 6")
  })
})
