const ru = {
  tab: "План",
  title: "План агента",
  progress: (done: number, total: number) => `${done} из ${total}`,
  working: "в работе",
  next: "следующая",
  note: "План ведёт агент. Чтобы поменять шаги, напишите ему в чат.",
}

const en: typeof ru = {
  tab: "Plan",
  title: "Agent plan",
  progress: (done: number, total: number) => `${done} of ${total}`,
  working: "in progress",
  next: "next",
  note: "The agent keeps this plan. To change the steps, tell it in the chat.",
}

export const planText = (locale: string) => (locale.split("-")[0] === "ru" ? ru : en)

export type PlanText = typeof ru
