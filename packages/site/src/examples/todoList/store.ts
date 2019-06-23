import { computed } from "mobx"
import {
  model,
  Model,
  modelAction,
  newModel,
  registerRootStore
} from "mobx-state-tree-next"

// the model decorator marks this class as a model, an object with actions, etc.
// the string identifies this model type and must be unique across your whole application
@model("todoSample/Todo")
export class Todo extends Model<{ text: string; done: boolean }> {
  // the stuff between <> above is the type of the (observable and snapshottable) data
  // your model will hold. it is also part of the required initialization data of the model

  // you can optionally use this to mark some data properties as optional and give them a
  // default value when not present
  defaultData = {
    done: false
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

@model("todoSample/TodoList")
export class TodoList extends Model<{ todos: Todo[] }> {
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
    newModel(Todo, { text: "make mobx-state-tree-next awesome!" }),
    newModel(Todo, { text: "spread the word" }),
    newModel(Todo, { text: "buy some milk", done: true })
  ]
})

// although not strictly required, it is always a good idea to register your root stores
// as such, since this allows the model hook `onAttachedToRootStore` to work and other goodies
registerRootStore(rootStore)
