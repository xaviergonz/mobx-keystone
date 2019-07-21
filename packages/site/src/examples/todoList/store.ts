import { computed } from "mobx"
import {
  connectReduxDevTools,
  model,
  Model,
  modelAction,
  ModelAutoTypeCheckingMode,
  newModel,
  registerRootStore,
  setGlobalConfig,
  types,
  TypeToData,
} from "mobx-keystone"

// for this example we will enable runtime data checking even in production mode
setGlobalConfig({
  modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
})

// here we define the type of the model data to have runtime checking
// this is only required if runtime type checking is needed
const todoDataType = types.object(() => ({
  text: types.string,
  done: types.boolean,
}))

// the model decorator marks this class as a model, an object with actions, etc.
// the string identifies this model type and must be unique across your whole application
@model("todoSample/Todo")
export class Todo extends Model<TypeToData<typeof todoDataType>> {
  // the stuff between <> above is the type of the (observable and snapshottable) data
  // your model will hold. it is also part of the required initialization data of the model
  // while we could just have used <{ text: string; done: boolean }> we use that construct
  // to inherit the proper type from the runtime type definition

  // you can optionally use this to mark some data properties as optional and give them a
  // default value when not present
  defaultData = {
    done: false,
  }

  // the modelAction decorator marks the function as a model action, giving it access
  // to modify any model data (inside `this.data`) and other superpowers such as action
  // middlewares, replication, etc.
  @modelAction
  setDone(done: boolean) {
    this.data.done = done
  }

  @modelAction
  setText(text: string) {
    this.data.text = text
  }
}

const todoListDataType = types.object(() => ({
  todos: types.array(types.model<Todo>(Todo)),
}))

@model("todoSample/TodoList")
export class TodoList extends Model<TypeToData<typeof todoListDataType>> {
  // again, we could have just used <{ todos: Todo[] }> if runtime type checking was not needed

  // standard mobx decorators (such as computed) can be used as usual, since anything inside
  // `this.data` is observable
  @computed
  get pending() {
    return this.data.todos.filter(t => !t.data.done)
  }

  @computed
  get done() {
    return this.data.todos.filter(t => t.data.done)
  }

  @modelAction
  add(todo: Todo) {
    this.data.todos.push(todo)
  }

  @modelAction
  remove(todo: Todo) {
    const list = this.data.todos
    const todoIndex = list.indexOf(todo)
    if (todoIndex >= 0) {
      list.splice(todoIndex, 1)
    }
  }
}

// important: to create new instances of models use `newModel` rather than the usual
// `new X()`. the second parameter is the initial data for the model
export const rootStore = newModel(TodoList, {
  todos: [
    newModel(Todo, { text: "make mobx-keystone awesome!" }),
    newModel(Todo, { text: "spread the word" }),
    newModel(Todo, { text: "buy some milk", done: true }),
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
