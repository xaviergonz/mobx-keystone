---
title: "Migration Guide: mobx-state-tree -> mobx-keystone"
slug: /mst-migration-guide
---

This is a practical, code-first guide for migrating an existing `mobx-state-tree` (MST) codebase to `mobx-keystone`.
It is written for humans first (from basics to advanced), with an LLM prompt/template at the end.

If you want a high-level feature comparison first, see [Comparison with mobx-state-tree](./mstComparison.mdx).

## Getting started

### What changes when moving from MST

- MST models are declared with `types.model(...)`; `mobx-keystone` models are TypeScript classes (`@model` + `extends Model(...)`).
- MST uses `self` inside actions/views; `mobx-keystone` uses `this` everywhere.
- MST references are identifier-like; `mobx-keystone` references are explicit `Ref<T>` objects.
- MST `getEnv(self)` becomes a context (`createContext`) in `mobx-keystone`.

### Decide upfront (saves time)

1. **Runtime type checking or not**
   - If you only need TypeScript, prefer `prop<T>()`.
   - If you need runtime validation, use `tProp(...)` and `types.*`.
2. **Persistence format**
   - MST persisted snapshots will not have `$modelType`. Plan a snapshot migration strategy (typed `fromSnapshot`, snapshot processors, or a one-time data migration).
   - If you use `tProp(...)` for a property, input snapshots for values stored in that property can often omit `$modelType` because the type is known from the property (useful when migrating persisted MST snapshots).
3. **Reference strategy**
   - Decide which relationships should be actual tree children vs references.

## Migration strategy (phases)

This order keeps the diff reviewable and avoids chasing cascading runtime issues:

1. Convert model definitions (data shape + basic actions/views).
2. Convert async flows (`flow` -> `@modelFlow`).
3. Convert environment/dependency injection (`getEnv` -> contexts).
4. Convert references (`types.reference`/`safeReference` -> `Ref` + `rootRef`/`customRef`).
5. Convert persistence and snapshots (especially if you have stored MST snapshots).
6. Convert patches/action replay/middleware integrations.
7. Run tests, then fix edge cases (lifecycle, collections, snapshot processors).

## Quick-start conversion rules

When converting a file/model, apply these in order:

1. Convert each `types.model(...)` to a class model: `@model("app/Type") class X extends Model({ ... }) {}`.
2. Convert properties into `prop(...)` (or `tProp(...)` only if you want runtime type checking).
3. Convert `views` into `@computed` getters and normal methods (use `this`, not `self`).
4. Convert synchronous `actions` into `@modelAction` methods.
5. Convert MST `flow` into `@modelFlow` and replace `yield promise` with `yield* _await(promise)`.
6. Convert `volatile` to plain class fields (add MobX `@observable` if you need reactivity).

## Common gotchas (read once)

### 1) No implicit snapshot assignment

MST commonly assigns snapshots into places where the type is “instance”.
In `mobx-keystone`, model properties are usually instance-typed, so convert explicitly.

```ts
// MST style (common)
self.selectedTodo = cast({ id: "t1", text: "hello" })

// mobx-keystone style
this.selectedTodo = fromSnapshot(Todo, { id: "t1", text: "hello" })
// or reconcile onto an existing instance:
applySnapshot(this.selectedTodo, { id: "t1", text: "hello", $modelType: this.selectedTodo.$modelType })
```

### 2) References have a different snapshot shape

MST references serialize as identifier-like values.
`mobx-keystone` references are model snapshots (for example `{ id: "x", $modelType: "myRefType" }`).
If you have persisted snapshots, plan a reference-snapshot migration (see “Snapshot processor migration”).

### 3) `safeReference` is explicit policy

`types.safeReference` behavior is not automatic by name.
In `mobx-keystone`, implement cleanup explicitly via `onResolvedValueChange` (see the worked example).

### 4) Arrays reject `undefined` by default

`mobx-keystone` arrays reject `undefined` elements by default (JSON compatibility).
If your MST state relies on `undefined` inside arrays, remodel to `null`/union-safe values or enable:

```ts
setGlobalConfig({
  allowUndefinedArrayElements: true,
})
```

### 5) `destroy`/`isAlive` semantics differ

MST has dead-node semantics (`destroy`, `isAlive`).
`mobx-keystone` does not: after detach/removal, instances remain usable objects.

### 6) IDs and refs are string-based

Refs require string IDs. If you used `types.identifierNumber`, keep your numeric field but implement:

```ts
getRefId() {
  return String(this.id)
}
```

### 7) Identifier mutability differs

MST identifiers are effectively immutable in typical usage.
In `mobx-keystone`, ID fields (including `idProp`) can be changed inside actions.
If you relied on immutability, treat IDs as write-once by convention or add guards/tests.

## End-to-end example

### MST version

```ts
import { cast, destroy, flow, getEnv, Instance, types } from "mobx-state-tree"

const Todo = types
  .model("Todo", {
    id: types.identifier,
    text: types.string,
    done: types.optional(types.boolean, false),
    createdAt: types.Date,
  })
  .volatile(() => ({
    isSaving: false,
  }))
  .views((self) => ({
    get label() {
      return `${self.done ? "DONE" : "TODO"} ${self.text}`
    },
  }))
  .actions((self) => ({
    setText(text: string) {
      self.text = text
    },
    toggle() {
      self.done = !self.done
    },
    load: flow(function* load() {
      const api = getEnv(self).api
      self.isSaving = true
      try {
        const dto: { text: string } = yield api.fetchTodo(self.id)
        self.text = dto.text
      } finally {
        self.isSaving = false
      }
    }),
  }))

const RootStore = types
  .model("RootStore", {
    todos: types.array(Todo),
    selectedTodo: types.safeReference(Todo),
  })
  .actions((self) => ({
    addTodo(text: string) {
      self.todos.push({ id: String(Date.now()), text, done: false, createdAt: new Date() })
    },
    removeTodo(todo: Instance<typeof Todo>) {
      destroy(todo)
    },
    select(todo?: Instance<typeof Todo>) {
      self.selectedTodo = cast(todo)
    },
  }))
```

### mobx-keystone version

```ts
import { action, computed, observable } from "mobx"
import {
  _await,
  createContext,
  detach,
  idProp,
  model,
  Model,
  modelAction,
  modelFlow,
  prop,
  Ref,
  registerRootStore,
  rootRef,
  timestampToDateTransform,
} from "mobx-keystone"

// Environment context replaces getEnv()
type Env = { api: { fetchTodo(id: string): Promise<{ text: string }> } }
const envCtx = createContext<Env>()

@model("todoApp/Todo")
class Todo extends Model({
  id: idProp,
  text: prop<string>().withSetter(),
  done: prop(false),
  createdAt: prop<number>().withTransform(timestampToDateTransform()),
}) {
  // volatile -> observable runtime field (not part of snapshots)
  @observable
  isSaving = false

  @action // MobX @action, not @modelAction — avoids unnecessary middleware/patch overhead for runtime-only fields
  setIsSaving(val: boolean) {
    this.isSaving = val
  }

  @computed
  get label() {
    return `${this.done ? "DONE" : "TODO"} ${this.text}`
  }

  @modelAction
  toggle() {
    this.done = !this.done
  }

  @modelFlow
  *load() {
    const api = envCtx.get(this)!.api
    this.setIsSaving(true)
    try {
      const dto: { text: string } = yield* _await(api.fetchTodo(this.id))
      this.setText(dto.text)
    } finally {
      this.setIsSaving(false)
    }
  }
}

// Safe reference: auto-detach when target is removed
const todoRef = rootRef<Todo>("todoApp/TodoRef", {
  onResolvedValueChange(ref, newValue, oldValue) {
    if (oldValue && !newValue) {
      detach(ref)
    }
  },
})

@model("todoApp/RootStore")
class RootStore extends Model({
  todos: prop<Todo[]>(() => []),
  selectedTodoRef: prop<Ref<Todo> | undefined>(),
}) {
  @computed
  get selectedTodo() {
    return this.selectedTodoRef?.maybeCurrent
  }

  @modelAction
  addTodo(text: string) {
    this.todos.push(new Todo({ text, done: false, createdAt: new Date() }))
  }

  @modelAction
  removeTodo(todo: Todo) {
    detach(todo) // equivalent of MST's destroy()
  }

  @modelAction
  select(todo: Todo | undefined) {
    this.selectedTodoRef = todo ? todoRef(todo) : undefined
  }
}

// Bootstrap: register root store and provide environment
const env: Env = { api: { fetchTodo: (id) => fetch(`/api/todos/${id}`).then((r) => r.json()) } }
const rootStore = envCtx.apply(() => new RootStore({}), env)
registerRootStore(rootStore)
```

## Topic guides (basics -> advanced)

### Environment migration (`getEnv`)

When MST code reads dependencies via `getEnv(self)`, migrate that dependency to a context.
This is the closest equivalent to dependency injection and makes models easier to unit test.

```ts
import { createContext } from "mobx-keystone"

type Env = { api: { fetchTodo(id: string): Promise<{ text: string }> } }
export const envCtx = createContext<Env>()

// bootstrap - wrap store creation in envCtx.apply(...)
const rootStore = envCtx.apply(() => new RootStore({}), env)
```

In models:

```ts
const env = envCtx.get(this)!
```

### Snapshots and persistence (MST snapshots -> mobx-keystone snapshots)

- `mobx-keystone` model snapshots include a `$modelType` metadata field that MST snapshots do not have.
- If you are loading old MST snapshots that do not include this field, use the typed overload of `fromSnapshot`:

```ts
const todo = fromSnapshot(Todo, oldSnapshotWithoutModelType)
```

- **Important:** if a property is declared with `tProp(...)`, then **input snapshots for the value stored in that property can omit** `$modelType`, because the type is known from the property.

```ts
@model("myApp/Todo")
class Todo extends Model({ id: idProp, text: tProp(types.string, "") }) {}

@model("myApp/Store")
class Store extends Model({
  // child model snapshots in this property do not need `$modelType`
  todos: tProp(types.array(Todo), () => []),
}) {}

fromSnapshot(Store, {
  todos: [{ id: "t1", text: "hello" }], // no `$modelType` needed here
})
```

This also applies to ref snapshots when using runtime type checking, e.g. `tProp(types.ref(todoRef))` can accept `{ id: "..." }` without `$modelType` for the ref object.

### Snapshot processor migration (advanced, but common for persisted data)

MST offers `preProcessSnapshot`/`postProcessSnapshot` (on model types) and `types.snapshotProcessor` (as a wrapper type).
In `mobx-keystone` there are two levels:

#### Model-level processors

Passed as the second argument to `Model()`:

```ts
@model("myApp/Todo")
class Todo extends Model(
  {
    text: prop<string>(),
    done: prop(false),
  },
  {
    fromSnapshotProcessor(sn: { text: string; completed?: boolean }) {
      // convert legacy "completed" field to "done"
      return { ...sn, done: sn.completed ?? false }
    },
    toSnapshotProcessor(sn) {
      return sn
    },
  }
) {}
```

#### Property-level processors

Chained on individual props via `.withSnapshotProcessor()`:

```ts
@model("myApp/Settings")
class Settings extends Model({
  volume: prop<number>().withSnapshotProcessor({
    fromSnapshot: (sn: string) => Number.parseFloat(sn),
    toSnapshot: (sn: number) => String(sn),
  }),
}) {}
```

### Model composition / inheritance (advanced)

MST's `types.compose(A, B)` merges two model types. In `mobx-keystone`, use `ExtendedModel`:

```ts
// MST
const Named = types.model({ name: types.string })
const Aged = types.model({ age: types.number })
const Person = types.compose("Person", Named, Aged)

// mobx-keystone
@model("myApp/Named")
class Named extends Model({ name: prop<string>() }) {}

@model("myApp/Person")
class Person extends ExtendedModel(Named, { age: prop<number>() }) {}
```

Note: `ExtendedModel` extends a single base class. If you need to merge more than two MST models, flatten the props or chain multiple `ExtendedModel` calls.

### Action replay, serialization, patches (advanced)

- `onPatch`/`applyPatch` becomes `onPatches`/`applyPatches`.
- `onAction` becomes `onActionMiddleware`.
- If you serialize actions over the wire, use `serializeActionCall`/`deserializeActionCall` and `applySerializedActionAndTrackNewModelIds`/`applySerializedActionAndSyncNewModelIds` as documented in [onActionMiddleware](./actionMiddlewares/onActionMiddleware.mdx).

## Appendix: API mapping cheat sheet (reference)

### Models and properties

| MST | mobx-keystone | Notes |
| --- | --- | --- |
| `types.model("Name", {...})` | `@model("app/Name") class X extends Model({...}) {}` | Model type string must be unique app-wide. |
| `types.compose(A, B)` | `class B extends ExtendedModel(A, {...}) {}` | Use class inheritance via `ExtendedModel`. |
| `types.string` / `types.number` / ... | `prop<T>()` or `tProp(types.string)` | Use `tProp` only if you need runtime type checking. |
| `types.optional(T, default)` | `prop(default)` or `tProp(T, default)` | Defaults belong in property declaration. |
| `types.maybe(T)` | `prop<T \| undefined>()` or `tProp(types.maybe(T))` | Optional value; `T` must include `undefined` explicitly. |
| `types.maybeNull(T)` | `prop<T \| null>()` or `tProp(types.maybeNull(T))` | Nullable value; `T` must include `null` explicitly. |
| `types.identifier` | `idProp` | Preferred model ID field. |
| `types.identifierNumber` | Prefer string IDs (`idProp`) or keep numeric field + override `getRefId()` to return `String(id)` | `mobx-keystone` refs require string IDs. |
| `types.late(() => T)` | Usually not needed with class references | Circular/lazy types are class references; use `types.late(() => T)` only in runtime type-checking declarations if needed. |

### Collections, dates, and frozen data

| MST | mobx-keystone | Notes |
| --- | --- | --- |
| `types.array(T)` | `prop<T[]>(() => [])` | Must provide default factory explicitly (MST auto-wraps in `types.optional`). |
| `types.map(T)` | `ObjectMap`, `asMap`, or `prop<Record<string, T>>(() => ({}))` | Choose based on API needs. `ObjectMap` is a model wrapper; `asMap` gives a `Map`-like API over an object/array. |
| `types.Date` | `prop<number>().withTransform(timestampToDateTransform())` | Or use `isoStringToDateTransform()` for ISO string snapshots. |
| `types.frozen(...)` | `frozen(data)` and/or `tProp(types.frozen(...))` | Preserve immutability + JSON-compat behavior. |
| `types.custom(...)` | Use property transforms (`.withTransform(...)`) | No direct `types.custom` equivalent; transforms handle snapshot to/from runtime conversion. |

### Runtime type checking (only needed if using `tProp`)

| MST | mobx-keystone | Notes |
| --- | --- | --- |
| `types.union(A, B)` | `types.or(A, B)` | Note the different name. |
| `types.enumeration(name, [...])` | `types.enum(MyTsEnum)` | Pass a TypeScript enum object directly. |
| `types.literal(value)` | `types.literal(value)` | Same name. |
| `types.refinement(T, predicate)` | `types.refinement(T, predicate, name?)` | Same concept; optional name argument for error messages. |

### Views, actions, and flows

| MST | mobx-keystone | Notes |
| --- | --- | --- |
| `.views((self) => ({ get x() {...} }))` | `@computed get x() {...}` | Use `this` everywhere instead of `self`. |
| `.views((self) => ({ fn(arg) {...} }))` | Plain class method | Non-getter views become regular methods. |
| `.actions((self) => ({ ... }))` | `@modelAction` methods | Remove `self`; use `this`. |
| `flow(function* ...)` | `@modelFlow *methodName() { yield* _await(...) }` | Async actions. `yield expr` becomes `yield* _await(expr)`. |
| `.extend((self) => ({ views: {...}, actions: {...} }))` | `@computed` getters + `@modelAction` methods + class fields | Combine all into the class body. |

### References

| MST | mobx-keystone | Notes |
| --- | --- | --- |
| `types.reference(Model)` | `prop<Ref<Model>>()` + `rootRef` / `customRef` | Explicit reference objects. Expose resolved value via `@computed` getter: `ref?.maybeCurrent`. |
| `types.safeReference(Model)` | `rootRef`/`customRef` with `onResolvedValueChange` cleanup | Implement the safe-cleanup policy explicitly. |
| Custom `get`/`set` on references | `customRef` with `getId` + `resolve` | See the [references docs](./references.mdx). |

### Snapshots, patches, and actions

| MST | mobx-keystone | Notes |
| --- | --- | --- |
| `getSnapshot` / `applySnapshot` / `onSnapshot` | `getSnapshot` / `applySnapshot` / `onSnapshot` | Same function names. |
| `onPatch` / `applyPatch` | `onPatches` / `applyPatches` | Note the plural. `onPatches` provides both patches and inverse patches. |
| `applyAction(...)` | `applyAction(...)` | Replay semantics are similar; serialization format differs. |
| `onAction` / `addMiddleware` | `onActionMiddleware` / `addActionMiddleware` / `actionTrackingMiddleware` | Pick the middleware level you need. |
| `preProcessSnapshot` / `postProcessSnapshot` / `types.snapshotProcessor` | Model-level: `Model(props, { fromSnapshotProcessor, toSnapshotProcessor })`. Property-level: `.withSnapshotProcessor({ fromSnapshot, toSnapshot })`. | Model-level processors are options on the second argument of `Model()`. |
| `clone(node)` | `clone(node)` | Same function name; generates new IDs by default. |

### Environment, lifecycle, and protection

| MST | mobx-keystone | Notes |
| --- | --- | --- |
| `getEnv(self)` | `createContext(...).get(this)` | Contexts are the preferred dependency injection pattern. |
| `.volatile((self) => ({ ... }))` | Class fields; add `@observable` + MobX `@action` if reactive | Runtime data is not snapshotted. |
| `afterCreate` | `onInit` | Always fires (no lazy initialization in `mobx-keystone`). |
| `afterAttach` | `onAttachedToRootStore` | Fires when attached to a registered root store tree. Can return a disposer. |
| `beforeDetach` / `beforeDestroy` | Return a disposer from `onAttachedToRootStore` | No exact 1:1 hook. Use disposer or parent action cleanup. |
| `unprotect` / `protect` / `isProtected` | Keep writes inside `@modelAction`; use `runUnprotected` only for bounded escape hatches | Prefer explicit action boundaries. |
| `destroy(node)` | `detach(node)` or remove from parent in a `@modelAction` | Detached nodes remain usable (no dead-node errors). |
| `isAlive(node)` | No direct equivalent | Detached nodes are still usable objects. |

### Tree navigation

| MST | mobx-keystone | Notes |
| --- | --- | --- |
| `getParent(node)` | `getParent(node)` | Same name. |
| `getRoot(node)` | `getRoot(node)` | Same name. |
| `getPath(node)` | `getRootPath(node).path` | Returns path array from root to node. |
| `isRoot(node)` | `isRoot(node)` | Same name. |
| `resolveIdentifier(Type, root, id)` | `rootRef` resolution or manual tree search | No direct equivalent; use references or tree traversal. |

## Appendix: LLM prompt template for project-wide conversion

Use this as a starting system/task prompt when asking an LLM to perform the migration:

```md
Migrate this codebase from mobx-state-tree to mobx-keystone.

Requirements:
1. Convert every MST model to a class model (`@model` + `extends Model`).
2. Convert `views` to `@computed` getters and plain methods; `actions` to `@modelAction`.
3. Convert MST `flow` to `@modelFlow` and use `yield* _await(...)`.
4. Replace `types.reference` with `Ref<T>` plus `rootRef`/`customRef`.
5. Replace `getEnv(self)` usage with `createContext` access.
6. Remove `cast(...)` usage where possible.
7. Preserve runtime behavior and public API shape.
8. Update tests affected by changed lifecycle/reference behavior.
9. Show all changed files with explanations for non-trivial choices.
10. Do not introduce new dependencies unless required.
11. Migrate `volatile` state to class fields with `@observable`/`@action` where reactive, plain fields otherwise.
12. Migrate snapshot processors to model-level `fromSnapshotProcessor`/`toSnapshotProcessor` or per-property `.withSnapshotProcessor(...)`.
13. Replace `unprotect`-style broad writes with `@modelAction` methods; use `runUnprotected` only where unavoidable.
14. Preserve ID semantics (especially if MST code relied on immutable identifiers).
15. Convert `types.Date` to `prop<number>().withTransform(timestampToDateTransform())`.
16. Convert `types.compose` to `ExtendedModel`.

After conversion, list:
- unresolved TODOs,
- places that need manual review,
- potential behavior changes.
```

## Final migration checklist

- [ ] Models compile with strict TypeScript.
- [ ] All `self` references replaced with `this`.
- [ ] `cast(...)` removed where possible.
- [ ] Actions/flows still enforce mutation boundaries correctly.
- [ ] References resolve and clean up as expected (including safe-reference behavior).
- [ ] Snapshot load/save round-trips are still valid (including `$modelType` metadata).
- [ ] `types.Date` properties migrated to property transforms.
- [ ] `types.map`/`types.array` defaults provided explicitly.
- [ ] Volatile state migrated to class fields with correct observability.
- [ ] Patch/action replication paths still work (note `onPatch` -> `onPatches`, `applyPatch` -> `applyPatches`).
- [ ] Environment injection migrated from `getEnv` to `createContext`.
- [ ] App root store registration (`registerRootStore`) is in place where lifecycle hooks require it.
- [ ] Existing tests pass, plus new tests for migrated edge cases.
