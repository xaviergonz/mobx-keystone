export type Todo = { text: string; done: boolean }

export type TreeStep = {
  todos: Todo[]
  /** Todo index the step acts on. */
  target?: number
  change?: "add" | "done" | "text"
  action?: { on: string; call: string }
  patch?: { op: "add" | "replace"; path: string; value: string }
}

const buyMilk: Todo = { text: "Buy milk", done: false }
const writeDocs: Todo = { text: "Write docs", done: false }
const shipV2: Todo = { text: "Ship v2", done: false }

export const treeSteps: TreeStep[] = [
  { todos: [] },
  {
    todos: [buyMilk],
    target: 0,
    change: "add",
    action: { on: "store", call: 'addTodo("Buy milk")' },
    patch: { op: "add", path: '["todos", 0]', value: '{ text: "Buy milk", … }' },
  },
  {
    todos: [buyMilk, writeDocs],
    target: 1,
    change: "add",
    action: { on: "store", call: 'addTodo("Write docs")' },
    patch: { op: "add", path: '["todos", 1]', value: '{ text: "Write docs", … }' },
  },
  {
    todos: [buyMilk, writeDocs, shipV2],
    target: 2,
    change: "add",
    action: { on: "store", call: 'addTodo("Ship v2")' },
    patch: { op: "add", path: '["todos", 2]', value: '{ text: "Ship v2", … }' },
  },
  {
    todos: [buyMilk, { ...writeDocs, done: true }, shipV2],
    target: 1,
    change: "done",
    action: { on: "todos[1]", call: "toggle()" },
    patch: { op: "replace", path: '["todos", 1, "done"]', value: "true" },
  },
  {
    todos: [{ ...buyMilk, done: true }, { ...writeDocs, done: true }, shipV2],
    target: 0,
    change: "done",
    action: { on: "todos[0]", call: "toggle()" },
    patch: { op: "replace", path: '["todos", 0, "done"]', value: "true" },
  },
  {
    todos: [
      { ...buyMilk, done: true },
      { ...writeDocs, done: true },
      { ...shipV2, text: "Ship v3" },
    ],
    target: 2,
    change: "text",
    action: { on: "todos[2]", call: 'setText("Ship v3")' },
    patch: { op: "replace", path: '["todos", 2, "text"]', value: '"Ship v3"' },
  },
]

export const lastTreeStep = treeSteps.length - 1
