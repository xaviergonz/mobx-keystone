<p align="center">
  <img src="./apps/site/static/img/logo.png" height="128" />
  <h1 align="center">mobx-keystone</h1>
</p>
<p align="center">
  <i>A MobX-powered state management solution based on data trees, with first-class support for TypeScript, snapshots, patches, and much more</i>
</p>

<p align="center">
  <a aria-label="NPM version" href="https://www.npmjs.com/package/mobx-keystone">
    <img src="https://img.shields.io/npm/v/mobx-keystone.svg?style=for-the-badge&logo=npm&labelColor=333" />
  </a>
  <a aria-label="License" href="./LICENSE">
    <img src="https://img.shields.io/npm/l/mobx-keystone.svg?style=for-the-badge&labelColor=333" />
  </a>
  <a aria-label="Types" href="./packages/lib/tsconfig.json">
    <img src="https://img.shields.io/npm/types/mobx-keystone.svg?style=for-the-badge&logo=typescript&labelColor=333" />
  </a>
  <br />
  <a aria-label="CI" href="https://github.com/xaviergonz/mobx-keystone/actions/workflows/main.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/xaviergonz/mobx-keystone/main.yml?branch=master&label=CI&logo=github&style=for-the-badge&labelColor=333" />
  </a>
  <a aria-label="Codecov" href="https://codecov.io/gh/xaviergonz/mobx-keystone">
    <img src="https://img.shields.io/codecov/c/github/xaviergonz/mobx-keystone?token=6MLRFUBK8V&label=codecov&logo=codecov&style=for-the-badge&labelColor=333" />
  </a>
  <a aria-label="Netlify Status" href="https://app.netlify.com/sites/mobx-keystone/deploys">
    <img src="https://img.shields.io/netlify/c5f60bcb-c1ff-4d04-ad14-1fc34ddbb429?label=netlify&logo=netlify&style=for-the-badge&labelColor=333" />
  </a>
</p>

> ### Full documentation can be found on the site:
>
> ## [mobx-keystone.js.org](https://mobx-keystone.js.org)

Collaborative editing is available through the [`mobx-keystone-yjs`](https://mobx-keystone.js.org/integrations/yjs-binding) and [`mobx-keystone-loro`](https://mobx-keystone.js.org/integrations/loro-binding) CRDT bindings, with complete examples in the online docs.

## Introduction

`mobx-keystone` helps you build complex client-side apps with a single source of truth, mutable model code, and immutable traceability built in.
You write straightforward actions and computed values, while the library gives you snapshots, patches, undo/redo, and runtime protection on top.

You can think of it as a TypeScript-first model layer on top of MobX that scales better as your domain grows.

### Quick links

- [Installation](https://mobx-keystone.js.org/installation)
- [Getting Started](https://mobx-keystone.js.org/getting-started)
- [Class Models](https://mobx-keystone.js.org/class-models)
- [Todo List Example](https://mobx-keystone.js.org/examples/todo-list)
- [MST Migration Guide](https://mobx-keystone.js.org/mst-migration-guide)
- [API docs](https://mobx-keystone.js.org/api/)

### Quick glance

```ts
import { computed } from "mobx"
import { Model, model, modelAction, prop, registerRootStore } from "mobx-keystone"

@model("todo/Todo")
class Todo extends Model({
  text: prop<string>(""),
  done: prop(false),
}) {
  @modelAction
  toggle() {
    this.done = !this.done
  }
}

@model("todo/Store")
class TodoStore extends Model({
  todos: prop<Todo[]>(() => []),
}) {
  @computed
  get pendingCount() {
    return this.todos.filter((t) => !t.done).length
  }

  @modelAction
  addTodo(text: string) {
    this.todos.push(new Todo({ text }))
  }
}

const store = new TodoStore({})
registerRootStore(store)
```

### Why teams choose mobx-keystone

- Mutable action code with protected updates, so state changes stay explicit and safe.
- Runtime snapshots and JSON patches for persistence, sync, replay, and debugging.
- Built-in primitives for references, transactions, action middlewares, and undo/redo.
- Strong TypeScript inference for models, snapshots, and actions.
- Composable domain models that stay maintainable as app complexity grows.
- Seamless integration with MobX and `mobx-react-lite`.

### What users are saying

> "I've never been so in love with a tool. [...] In my eyes it is the perfect state management tool for TS/React projects. [...] Building complex clientside apps has never been so easy and fun for me."
>
> - [@finallyblueskies](https://github.com/finallyblueskies), [#538](https://github.com/xaviergonz/mobx-keystone/issues/538)

> "I'm absolutely loving this project. [...] It's taken all the best bits from mobx and mobx-state-tree and put them into a single package that's a joy to work with. [...] You've literally thought of everything!"
>
> - [@robclouth](https://github.com/robclouth), [#146](https://github.com/xaviergonz/mobx-keystone/issues/146)

### How it works

At the center of `mobx-keystone` is a _living tree_ of mutable but strictly protected models, arrays, and plain objects.
You update state through model actions, and immutable structurally shared snapshots are derived automatically.

This gives you mutability where it helps developer experience, plus immutable traceability where it helps reliability.

Trees can only be modified by actions that belong to the same subtree.
Actions are replayable and can be distributed, and fine-grained changes can be observed as JSON patches.

Because `mobx-keystone` uses MobX behind the scenes, it integrates naturally with [`mobx`](https://mobx.js.org) and [`mobx-react-lite`](https://github.com/mobxjs/mobx/tree/main/packages/mobx-react-lite).
The snapshot and middleware system also makes it possible to replace a Redux reducer/store pair with model-driven state and connect Redux devtools.

`mobx-keystone` consists of composable _models_ that capture domain state and behavior together.
Model instances are created from props, protect their own updates, and reconcile efficiently when applying snapshots.

## Requirements

This library requires a modern JavaScript environment with support for:

- MobX 7, 6, 5 (or 4 with its gotchas)
- Proxies
- Symbols
- WeakMap/WeakSet

In practice, this covers current browsers and Node.js releases, but not Internet Explorer.

TypeScript 5.0 or newer is recommended so you can use standard decorators. Legacy decorators remain supported by `mobx-keystone`; see the [installation guide](https://mobx-keystone.js.org/installation) for the required compiler configuration and the MobX 7 compatibility note.

## Installation

> `npm install mobx mobx-keystone`

> `yarn add mobx mobx-keystone`

> `pnpm add mobx mobx-keystone`

`mobx` is a peer dependency and must be installed alongside `mobx-keystone`.
