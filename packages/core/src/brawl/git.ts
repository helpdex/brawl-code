export * as BrawlGit from "./git.js"

import path from "path"
import { Effect, Schema, type Duration } from "effect"
import { ChildProcess } from "effect/process"
import type { AppProcess } from "@opencode/util/process"
import type { Vcs } from "@opencode/schema/vcs"
import { gitExecutable } from "../util/git-executable.js"

export class Failure extends Schema.TaggedError<Failure>()("BrawlGit.Failure", {
  step: Schema.Literals(["commit", "discard", "message"]),
  message: Schema.String,
}) {}

export interface Commit {
  readonly hash: string
  readonly branch?: string
  readonly pushed: boolean
  readonly pushError?: string
}

const DIFF_CHARS = 24_000
const env = { GIT_TERMINAL_PROMPT: "0", GIT_EDITOR: "true", LC_ALL: "C" }

const git = (
  proc: AppProcess.Interface,
  cwd: string,
  args: string[],
  options?: { stdin?: string; timeout?: Duration.Input },
) =>
  proc
    .run(ChildProcess.make(gitExecutable(), args, { cwd, env, extendEnv: true }), {
      stdin: options?.stdin ?? "",
      timeout: options?.timeout ?? "60 seconds",
      maxOutputBytes: 4 * 1024 * 1024,
    })
    .pipe(
      Effect.map((result) => ({
        code: result.exitCode,
        out: result.stdout.toString("utf8"),
        err: result.stderr.toString("utf8").trim(),
      })),
      Effect.orElseSucceed(() => ({ code: -1, out: "", err: "git did not finish" })),
    )

const fail = (step: Failure["step"], result: { out: string; err: string }, fallback: string) =>
  new Failure({ step, message: (result.err || result.out.trim() || fallback).split("\n").slice(-6).join("\n") })

const literal = (file: string) => `:(literal)${file}`

const chunks = <A>(items: readonly A[], size = 200) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))

export const branch = Effect.fn("BrawlGit.branch")(function* (proc: AppProcess.Interface, cwd: string) {
  const result = yield* git(proc, cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"])
  return result.code === 0 ? result.out.trim() || undefined : undefined
})

export const commit = Effect.fn("BrawlGit.commit")(function* (
  proc: AppProcess.Interface,
  cwd: string,
  input: { readonly message: string; readonly push: boolean },
) {
  const message = input.message.trim()
  if (!message) return yield* new Failure({ step: "commit", message: "The commit message is empty" })
  const add = yield* git(proc, cwd, ["add", "--all", "--", "."])
  if (add.code !== 0) return yield* fail("commit", add, "git add failed")
  const staged = yield* git(proc, cwd, ["diff", "--cached", "--quiet"])
  if (staged.code === 0) return yield* new Failure({ step: "commit", message: "Nothing to commit" })
  const done = yield* git(proc, cwd, ["commit", "--quiet", "--file", "-"], {
    stdin: message + "\n",
    timeout: "180 seconds",
  })
  if (done.code !== 0) return yield* fail("commit", done, "git commit failed")
  const hash = (yield* git(proc, cwd, ["rev-parse", "--short", "HEAD"])).out.trim()
  const current = yield* branch(proc, cwd)
  const result: Commit = { hash, ...(current ? { branch: current } : {}), pushed: false }
  if (!input.push) return result
  const pushError = yield* push(proc, cwd, current)
  return pushError ? { ...result, pushError } : { ...result, pushed: true }
})

const push = Effect.fn("BrawlGit.push")(function* (proc: AppProcess.Interface, cwd: string, current?: string) {
  if (!current) return "HEAD is detached"
  const upstream = yield* git(proc, cwd, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"])
  if (upstream.code === 0) {
    const result = yield* git(proc, cwd, ["push", "--quiet"], { timeout: "180 seconds" })
    return result.code === 0 ? undefined : fail("commit", result, "git push failed").message
  }
  const remotes = (yield* git(proc, cwd, ["remote"])).out.split("\n").filter(Boolean)
  const remote = remotes.includes("origin") ? "origin" : remotes[0]
  if (!remote) return "No remote configured"
  const result = yield* git(proc, cwd, ["push", "--quiet", "--set-upstream", remote, `HEAD:refs/heads/${current}`], {
    timeout: "180 seconds",
  })
  return result.code === 0 ? undefined : fail("commit", result, "git push failed").message
})

export const discard = Effect.fn("BrawlGit.discard")(function* (
  proc: AppProcess.Interface,
  input: { readonly worktree: string; readonly files: readonly string[]; readonly status: readonly Vcs.FileStatus[] },
) {
  const head = yield* git(proc, input.worktree, ["rev-parse", "--verify", "--quiet", "HEAD"])
  if (head.code !== 0) return yield* new Failure({ step: "discard", message: "The repository has no commits yet" })
  const wanted = new Set(input.files)
  const folders = input.files.filter((file) => file.endsWith("/"))
  const listed = (file: string) => wanted.has(file) || folders.some((folder) => file.startsWith(folder))
  const targets = input.status.filter((row) => listed(row.file) && safe(input.worktree, row.file))
  const added = targets.filter((row) => row.status === "added").map((row) => row.file)
  const changed = targets.filter((row) => row.status !== "added").map((row) => row.file)
  for (const group of chunks(changed)) {
    const result = yield* git(proc, input.worktree, [
      "restore",
      "--source=HEAD",
      "--staged",
      "--worktree",
      "--",
      ...group.map(literal),
    ])
    if (result.code !== 0) return yield* fail("discard", result, "git restore failed")
  }
  for (const group of chunks(added)) {
    const unstage = yield* git(proc, input.worktree, [
      "rm",
      "--cached",
      "--quiet",
      "--ignore-unmatch",
      "--",
      ...group.map(literal),
    ])
    if (unstage.code !== 0) return yield* fail("discard", unstage, "git rm failed")
    const clean = yield* git(proc, input.worktree, ["clean", "--force", "--quiet", "--", ...group.map(literal)])
    if (clean.code !== 0) return yield* fail("discard", clean, "git clean failed")
  }
  return targets.map((row) => row.file)
})

function safe(worktree: string, file: string) {
  if (!file || path.isAbsolute(file) || file.split(/[\\/]/).includes("..")) return false
  const resolved = path.resolve(worktree, file)
  return resolved.startsWith(path.resolve(worktree) + path.sep)
}

export const prompt = Effect.fn("BrawlGit.prompt")(function* (
  proc: AppProcess.Interface,
  cwd: string,
  input: { readonly title?: string },
) {
  const head = (yield* git(proc, cwd, ["rev-parse", "--verify", "--quiet", "HEAD"])).code === 0
  const base = head ? ["HEAD"] : ["--cached"]
  const stat = (yield* git(proc, cwd, ["diff", ...base, "--stat=120", "--", "."])).out.trim()
  const diff = (yield* git(proc, cwd, ["diff", ...base, "--no-color", "--unified=2", "--", "."])).out
  const untracked = (yield* git(proc, cwd, ["ls-files", "--others", "--exclude-standard", "--", "."])).out
    .split("\n")
    .filter(Boolean)
  if (!stat && untracked.length === 0) return yield* new Failure({ step: "message", message: "Nothing to commit" })
  const log = head ? (yield* git(proc, cwd, ["log", "-10", "--format=%s"])).out.trim() : ""
  return [
    "Write a git commit message for the changes below.",
    "Return only the message: a subject line of at most 72 characters in the imperative mood, then, if the change",
    "needs it, a blank line and a short body. No quotes, no code fences, no explanations.",
    log
      ? "Match the language and style of the recent commit subjects."
      : "Write it in English, in the style of Conventional Commits.",
    input.title ? `\nThe task in the coding session: ${input.title}` : "",
    log ? `\nRecent commit subjects:\n${log}` : "",
    stat ? `\nChanged files:\n${stat}` : "",
    untracked.length ? `\nNew files:\n${untracked.slice(0, 50).join("\n")}` : "",
    diff ? `\nDiff:\n${diff.length > DIFF_CHARS ? diff.slice(0, DIFF_CHARS) + "\n[diff truncated]" : diff}` : "",
  ]
    .filter(Boolean)
    .join("\n")
})

export function message(text: string) {
  const body = text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/^\s*```[a-z]*\n?|\n?```\s*$/g, "")
    .replace(/^\s*(commit message|сообщение коммита)\s*:\s*/i, "")
    .trim()
  const unquoted = /^(["'`«])([\s\S]*)(["'`»])$/.test(body) ? body.slice(1, -1).trim() : body
  return unquoted.slice(0, 4000)
}
