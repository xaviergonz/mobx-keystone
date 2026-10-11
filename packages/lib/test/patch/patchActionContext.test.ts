import {
  ActionContextActionType,
  ActionContextAsyncStepType,
  applySnapshot,
  getCurrentActionContext,
  _async,
  _await,
  getSnapshot,
  idProp,
  Model,
  modelAction,
  modelFlow,
  onGlobalPatches,
  onPatches,
  prop,
} from "../../src"
import { autoDispose, testModel } from "../utils"

interface SeenContext {
  actionName: string | undefined
  rootActionName: string | undefined
  type?: ActionContextActionType
  asyncStepType?: ActionContextAsyncStepType
}

function seenContext(): SeenContext {
  const ctx = getCurrentActionContext()
  return {
    actionName: ctx?.actionName,
    rootActionName: ctx?.rootContext.actionName,
    type: ctx?.type,
    asyncStepType: ctx?.asyncStepType,
  }
}

@testModel("Store")
class Store extends Model({
  id: idProp,
  value: prop(0),
  items: prop<number[]>(() => []),
}) {
  @modelAction
  outer() {
    this.value++
    this.inner()
    this.items.splice(0, 0, 1)
  }

  @modelAction
  inner() {
    this.value++
  }

  @modelFlow
  load = _async(function* (this: Store) {
    this.value = 9
    yield* _await(Promise.resolve())
    this.value = 10
  })
}

test("the context of the action that made a change is current inside patch listeners", async () => {
  const store = new Store({})

  const seenByOnPatches: SeenContext[] = []
  const seenByOnGlobalPatches: SeenContext[] = []
  autoDispose(
    onPatches(store, () => {
      seenByOnPatches.push(seenContext())
    })
  )
  autoDispose(
    onGlobalPatches(() => {
      seenByOnGlobalPatches.push(seenContext())
    })
  )

  store.outer()
  applySnapshot(store, { ...getSnapshot(store), value: 5 })
  await store.load()

  const sync = ActionContextActionType.Sync
  const expected: SeenContext[] = [
    // a model action
    { actionName: "outer", rootActionName: "outer", type: sync, asyncStepType: undefined },
    // a nested action
    { actionName: "inner", rootActionName: "outer", type: sync, asyncStepType: undefined },
    // an array splice inside an action
    { actionName: "outer", rootActionName: "outer", type: sync, asyncStepType: undefined },
    // applySnapshot
    {
      actionName: "$$applySnapshot",
      rootActionName: "$$applySnapshot",
      type: sync,
      asyncStepType: undefined,
    },
    // each step of a flow
    {
      actionName: "load",
      rootActionName: "load",
      type: ActionContextActionType.Async,
      asyncStepType: ActionContextAsyncStepType.Resume,
    },
    {
      actionName: "load",
      rootActionName: "load",
      type: ActionContextActionType.Async,
      asyncStepType: ActionContextAsyncStepType.Resume,
    },
  ]
  expect(seenByOnPatches).toStrictEqual(expected)
  expect(seenByOnGlobalPatches).toStrictEqual(expected)
})
