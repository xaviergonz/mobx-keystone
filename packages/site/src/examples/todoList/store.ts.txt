import { computed } from "mobx"
import {
  connectReduxDevTools,
  model,
  Model,
  modelAction,
  ModelAutoTypeCheckingMode,
  registerRootStore,
  setGlobalConfig,
  tProp,
  types,
} from "mobx-keystone"
import { v4 as uuidv4 } from "uuid"

// for this example we will enable runtime data checking even in production mode
setGlobalConfig({
  modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
})

// the model decorator marks this class as a model, an object with actions, etc.
// the string identifies this model type and must be unique across your whole application
@model("todoSample/Todo")
export class Todo extends Model({
  // here we define the type of the model data, which is observable and snapshottable
  // and also part of the required initialization data of the model

  // in this case we use runtime type checking,
  id: tProp(types.string, () => uuidv4()), // an optional string that will use a random id when not provided
  text: tProp(types.string), // a required string
  done: tProp(types.boolean, false), // an optional boolean that will default to false

  // if we didn't require runtime type checking we could do this
  // id: prop(() => uuidv4())
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
  todos: tProp(types.array(types.model<Todo>(Todo)), () => []),

  // if we didn't require runtime type checking
  // todos: prop<Todo[]>(() => [])
}) {
  // standard mobx decorators (such as computed) can be used as usual, since props are observables
  @computed
  get pending() {
    return this.todos.filter(t => !t.done)
  }

  @computed
  get done() {
    return this.todos.filter(t => t.done)
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

export function createRootStore(): TodoList {
  // the parameter is the initial data for the model
  const rootStore = new TodoList({
    todos: [
      new Todo({ text: "make mobx-keystone awesome!" }),
      new Todo({ text: "spread the word" }),
      new Todo({ text: "buy some milk", done: true }),
    ],
  })

  // although not strictly required, it is always a good idea to register your root stores
  // as such, since this allows the model hook `onAttachedToRootStore` to work and other goodies
  registerRootStore(rootStore)

  // we can also connect the store to the redux dev tools
  const remotedev = require("remotedev")
  const connection = remotedev.connectViaExtension({
    name: "Todo List Example",
  })

  connectReduxDevTools(remotedev, connection, rootStore)

  return rootStore
}
