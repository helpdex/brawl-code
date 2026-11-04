const ruPlural = (count: number, one: string, few: string, many: string) => {
  const ten = count % 10
  const hundred = count % 100

  if (ten === 1 && hundred !== 11) return one

  if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14)) return few

  return many
}

const ru = {
  revertAll: "Откатить всё",
  commit: "Коммит…",
  revertTitle: "Откатить все изменения?",
  revertGit: (count: number) =>
    `${count} ${ruPlural(count, "файл вернётся", "файла вернутся", "файлов вернутся")} к последнему коммиту — и правки агента, и ваши. Новые файлы будут удалены. Отменить это нельзя.`,
  revertTurn: (count: number) =>
    `${count} ${ruPlural(count, "файл вернётся", "файла вернутся", "файлов вернутся")} к состоянию до последнего ответа агента. Ваши правки в них после этого тоже пропадут. Переписка останется.`,
  revertBusy: "Агент ещё работает — дождитесь конца ответа",
  removed: "удалится",
  more: (count: number) => `и ещё ${count}`,
  revertButton: (count: number) => `Откатить ${count} ${ruPlural(count, "файл", "файла", "файлов")}`,
  reverted: (count: number) => `Откатил ${count} ${ruPlural(count, "файл", "файла", "файлов")}`,
  revertFailed: "Не удалось откатить",
  cancel: "Отмена",
  commitTitle: "Коммит",
  files: (count: number) => `${count} ${ruPlural(count, "файл", "файла", "файлов")}`,
  placeholder: "Сообщение коммита. Оставьте пустым — Brawl Code напишет его сам по изменениям и переписке.",
  includes: "Войдут все незакоммиченные изменения",
  commitAction: "Коммит",
  commitMenu: "Другие действия",
  commitLocal: "Только локально",
  commitPush: "Коммит и push",
  pushTo: (target: string) => `в ${target}`,
  writing: "Пишу сообщение…",
  committing: "Коммичу…",
  pushing: "Коммичу и отправляю…",
  committed: (hash: string, branch?: string) => (branch ? `Коммит ${hash} в ${branch}` : `Коммит ${hash}`),
  pushed: "Отправлен на сервер",
  pushFailed: "Коммит создан, но push не прошёл",
  commitFailed: "Не удалось сделать коммит",
}

const en: typeof ru = {
  revertAll: "Revert all",
  commit: "Commit…",
  revertTitle: "Revert all changes?",
  revertGit: (count: number) =>
    `${count} ${count === 1 ? "file goes" : "files go"} back to the last commit, with both the agent's edits and yours. New files will be deleted. This can't be undone.`,
  revertTurn: (count: number) =>
    `${count} ${count === 1 ? "file goes" : "files go"} back to how ${count === 1 ? "it was" : "they were"} before the agent's last reply. Your later edits to ${count === 1 ? "it" : "them"} go too. The conversation stays.`,
  revertBusy: "The agent is still working; wait for the reply to finish",
  removed: "deleted",
  more: (count: number) => `and ${count} more`,
  revertButton: (count: number) => `Revert ${count} ${count === 1 ? "file" : "files"}`,
  reverted: (count: number) => `Reverted ${count} ${count === 1 ? "file" : "files"}`,
  revertFailed: "Couldn't revert",
  cancel: "Cancel",
  commitTitle: "Commit",
  files: (count: number) => `${count} ${count === 1 ? "file" : "files"}`,
  placeholder: "Commit message. Leave it empty and Brawl Code writes one from the changes and the conversation.",
  includes: "Includes every uncommitted change",
  commitAction: "Commit",
  commitMenu: "More actions",
  commitLocal: "Local only",
  commitPush: "Commit and push",
  pushTo: (target: string) => `to ${target}`,
  writing: "Writing the message…",
  committing: "Committing…",
  pushing: "Committing and pushing…",
  committed: (hash: string, branch?: string) => (branch ? `Committed ${hash} to ${branch}` : `Committed ${hash}`),
  pushed: "Pushed",
  pushFailed: "Committed, but the push failed",
  commitFailed: "Couldn't commit",
}

export const reviewText = (locale: string) => (locale.split("-")[0] === "ru" ? ru : en)

export type ReviewText = typeof ru
