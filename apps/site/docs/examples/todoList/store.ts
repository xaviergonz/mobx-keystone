import { computed } from "mobx"
import {
  connectReduxDevTools,
  idProp,
  model,
  Model,
  modelAction,
  ModelAutoTypeCheckingMode,
  registerRootStore,
  setGlobalConfig,
  tProp,
  types,
} from "mobx-keystone"

// for this example we will enable runtime data checking even in production mode
setGlobalConfig({
  modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
})

// the model decorator marks this class as a model, an object with actions, etc.
// the string identifies this model type and must be unique across your whole application
@model("todoSample/Todo")
export class Todo extends Model({
  // here we define the type of the model data, which is observable and snapshotable
  // and also part of the required initialization data of the model

  // in this case we use runtime type checking,
  id: idProp, // an optional string that will use a random id when not provided
  text: tProp(types.string), // a required string
  done: tProp(types.boolean, false), // an optional boolean that will default to false

  // if we didn't require runtime type checking we could do this
  // id: idProp,
  // text: prop<string>(),
  // done: prop(false)
}) {
  // the modelAction decorator marks the function as a model action, giving it access
  // to modify any model data and other superpowers such as action
  // middlewares, replication, etc.
  @modelAction
  setDone(done: boolean) {
    this.done = done
  }

  @modelAction
  setText(text: string) {
    this.text = text
  }
}

@model("todoSample/TodoList")
export class TodoList extends Model({
  // in this case the default uses an arrow function to create the object since it is not a primitive
  // and we need a different array for each model instane
  todos: tProp(types.array(types.model(Todo)), () => []),

  // if we didn't require runtime type checking
  // todos: prop<Todo[]>(() => [])
}) {
  // standard mobx decorators (such as computed) can be used as usual, since props are observables
  @computed
  get pending() {
    return this.todos.filter((t) => !t.done)
  }

  @computed
  get done() {
    return this.todos.filter((t) => t.done)
  }

  @modelAction
  add(todo: Todo) {
    this.todos.push(todo)
  }

  @modelAction
  remove(todo: Todo) {
    const index = this.todos.indexOf(todo)
    if (index >= 0) {
      this.todos.splice(index, 1)
    }
  }
}

export function createDefaultTodoList(): TodoList {
  // the parameter is the initial data for the model
  return new TodoList({
    todos: [
      new Todo({ text: "make mobx-keystone awesome!" }),
      new Todo({ text: "spread the word" }),
      new Todo({ text: "buy some milk", done: true }),
    ],
  })
}

export function createRootStore(): TodoList {
  const rootStore = createDefaultTodoList()

  // although not strictly required, it is always a good idea to register your root stores
  // as such, since this allows the model hook `onAttachedToRootStore` to work and other goodies
  registerRootStore(rootStore)

  // we can also connect the store to the redux dev tools
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const remotedev = require("remotedev")
  const connection = remotedev.connectViaExtension({
    name: "Todo List Example",
  })

  connectReduxDevTools(remotedev, connection, rootStore)

  return rootStore
}
