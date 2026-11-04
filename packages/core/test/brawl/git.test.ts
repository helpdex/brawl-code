import { describe, expect } from "bun:test"
import { execFileSync } from "node:child_process"
import fs from "node:fs/promises"
import { realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { Effect, Exit } from "effect"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { AppProcess } from "@opencode/util/process"
import { BrawlGit } from "@opencode/core/brawl/git"
import { testEffect } from "../lib/effect"

const it = testEffect(LayerNode.compile(AppProcess.node))

const sh = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim()

const repo = Effect.acquireRelease(
  Effect.promise(async () => {
    const dir = realpathSync(await fs.mkdtemp(path.join(tmpdir(), "brawl-git-")))
    sh(dir, "init", "--quiet", "--initial-branch=main")
    sh(dir, "config", "user.email", "test@example.com")
    sh(dir, "config", "user.name", "Test")
    sh(dir, "config", "commit.gpgsign", "false")
    await fs.writeFile(path.join(dir, "a.txt"), "one\n")
    await fs.writeFile(path.join(dir, "b.txt"), "two\n")
    sh(dir, "add", ".")
    sh(dir, "commit", "--quiet", "-m", "feat: start")
    return dir
  }),
  (dir) => Effect.promise(() => fs.rm(dir, { recursive: true, force: true })),
)

describe("BrawlGit", () => {
  it.live("commits everything uncommitted and reports the branch", () =>
    Effect.gen(function* () {
      const dir = yield* repo
      const proc = yield* AppProcess.Service
      yield* Effect.promise(() => fs.writeFile(path.join(dir, "a.txt"), "one\nmore\n"))
      yield* Effect.promise(() => fs.writeFile(path.join(dir, "new.txt"), "new\n"))
      const result = yield* BrawlGit.commit(proc, dir, { message: 'fix: quote "it"\n\nBody line', push: false })
      expect(result.branch).toBe("main")
      expect(result.pushed).toBe(false)
      expect(result.hash).toBe(sh(dir, "rev-parse", "--short", "HEAD"))
      expect(sh(dir, "log", "-1", "--format=%B")).toBe('fix: quote "it"\n\nBody line')
      expect(sh(dir, "status", "--porcelain")).toBe("")
    }),
  )

  it.live("refuses an empty commit and says why a push failed", () =>
    Effect.gen(function* () {
      const dir = yield* repo
      const proc = yield* AppProcess.Service
      const empty = yield* BrawlGit.commit(proc, dir, { message: "chore: nothing", push: false }).pipe(Effect.exit)
      expect(Exit.isFailure(empty)).toBe(true)
      yield* Effect.promise(() => fs.writeFile(path.join(dir, "b.txt"), "changed\n"))
      const result = yield* BrawlGit.commit(proc, dir, { message: "chore: change", push: true })
      expect(result.pushed).toBe(false)
      expect(result.pushError).toBe("No remote configured")
      expect(sh(dir, "log", "-1", "--format=%s")).toBe("chore: change")
    }),
  )

  it.live("pushes and publishes a branch without an upstream", () =>
    Effect.gen(function* () {
      const dir = yield* repo
      const remote = `${dir}-remote.git`
      execFileSync("git", ["init", "--quiet", "--bare", remote])
      sh(dir, "remote", "add", "origin", remote)
      const proc = yield* AppProcess.Service
      yield* Effect.promise(() => fs.writeFile(path.join(dir, "a.txt"), "pushed\n"))
      const result = yield* BrawlGit.commit(proc, dir, { message: "feat: push", push: true })
      expect(result.pushed).toBe(true)
      expect(execFileSync("git", ["log", "-1", "--format=%s", "main"], { cwd: remote, encoding: "utf8" }).trim()).toBe(
        "feat: push",
      )
      expect(sh(dir, "rev-parse", "--abbrev-ref", "@{upstream}")).toBe("origin/main")
      yield* Effect.promise(() => fs.rm(remote, { recursive: true, force: true }))
    }),
  )

  it.live("discards only listed uncommitted files, deleting new ones", () =>
    Effect.gen(function* () {
      const dir = yield* repo
      const proc = yield* AppProcess.Service
      yield* Effect.promise(async () => {
        await fs.writeFile(path.join(dir, "a.txt"), "edited\n")
        await fs.writeFile(path.join(dir, "b.txt"), "kept\n")
        await fs.mkdir(path.join(dir, "new"))
        await fs.writeFile(path.join(dir, "new", "c.txt"), "new\n")
        await fs.writeFile(path.join(dir, "staged.txt"), "staged\n")
      })
      sh(dir, "add", "staged.txt")
      const status = [
        { file: "a.txt", additions: 1, deletions: 1, status: "modified" as const },
        { file: "b.txt", additions: 1, deletions: 1, status: "modified" as const },
        { file: "new/c.txt", additions: 1, deletions: 0, status: "added" as const },
        { file: "staged.txt", additions: 1, deletions: 0, status: "added" as const },
      ]
      const files = yield* BrawlGit.discard(proc, {
        worktree: dir,
        files: ["a.txt", "new/", "staged.txt", "../outside.txt"],
        status,
      })
      expect(files).toEqual(["a.txt", "new/c.txt", "staged.txt"])
      expect(yield* Effect.promise(() => fs.readFile(path.join(dir, "a.txt"), "utf8"))).toBe("one\n")
      expect(yield* Effect.promise(() => fs.readFile(path.join(dir, "b.txt"), "utf8"))).toBe("kept\n")
      expect(sh(dir, "status", "--porcelain")).toBe("M b.txt")
    }),
  )

  it.live("writes a prompt from the diff and recent subjects", () =>
    Effect.gen(function* () {
      const dir = yield* repo
      const proc = yield* AppProcess.Service
      yield* Effect.promise(() => fs.writeFile(path.join(dir, "a.txt"), "one\nadded line\n"))
      const prompt = yield* BrawlGit.prompt(proc, dir, { title: "Add a line" })
      expect(prompt).toContain("The task in the coding session: Add a line")
      expect(prompt).toContain("feat: start")
      expect(prompt).toContain("+added line")
      sh(dir, "checkout", "--quiet", "--", "a.txt")
      const nothing = yield* BrawlGit.prompt(proc, dir, {}).pipe(Effect.exit)
      expect(Exit.isFailure(nothing)).toBe(true)
    }),
  )

  it.live("cleans the model's reply into a commit message", () =>
    Effect.sync(() => {
      expect(BrawlGit.message("<think>hmm</think>\n```\nfix: handle empty cart\n```")).toBe("fix: handle empty cart")
      expect(BrawlGit.message('Commit message: "feat: add payments"')).toBe("feat: add payments")
      expect(BrawlGit.message("  ")).toBe("")
    }),
  )
})
