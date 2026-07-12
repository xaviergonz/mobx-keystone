import { getSnapshot, Model, modelAction, prop, runUnprotected, undoMiddleware } from "../../src"
import { testModel } from "../utils"

@testModel("deferredSnapshot/Leaf")
class Leaf extends Model({
  value: prop(0),
}) {
  @modelAction
  setValue(value: number): void {
    this.value = value
  }
}

@testModel("deferredSnapshot/Root")
class Root extends Model({
  leaves: prop<Leaf[]>(() => []),
}) {
  @modelAction
  mutateThenRemove(): void {
    this.leaves[0].setValue(10)
    this.leaves.splice(0, 1)
  }

  @modelAction
  mutateThenReindex(): void {
    this.leaves[1].setValue(20)
    this.leaves.splice(0, 1)
  }
}

test("dirty child removal round-trips through undo", () => {
  const root = new Root({ leaves: [new Leaf({ value: 1 }), new Leaf({ value: 2 })] })
  const undoManager = undoMiddleware(root)
  const before = getSnapshot(root)

  root.mutateThenRemove()
  const after = getSnapshot(root)

  expect(after.leaves).toHaveLength(1)
  expect(after.leaves[0].value).toBe(2)

  undoManager.undo()
  expect(getSnapshot(root)).toEqual(before)

  undoManager.redo()
  expect(getSnapshot(root)).toEqual(after)
})

test("dirty array children use their reindexed parent path", () => {
  const root = new Root({ leaves: [new Leaf({ value: 1 }), new Leaf({ value: 2 })] })

  root.mutateThenReindex()

  expect(getSnapshot(root).leaves).toMatchObject([{ value: 20 }])
})

test("rejected array writes do not lose pending ancestor snapshot updates", () => {
  const root = new Root({ leaves: [new Leaf({ value: 1 }), new Leaf({ value: 2 })] })

  runUnprotected(() => {
    root.leaves[1].setValue(20)
    expect(() => {
      root.leaves[0] = undefined as never
    }).toThrow("undefined is not supported inside arrays")

    expect(getSnapshot(root).leaves).toMatchObject([{ value: 1 }, { value: 20 }])
  })
})

test("model output processors remain eager across deferred plain ancestors", () => {
  let processorCalls = 0

  @testModel("deferredSnapshot/ProcessorRoot")
  class ProcessorRoot extends Model(
    {
      leaves: prop<Leaf[]>(() => []),
    },
    {
      toSnapshotProcessor(snapshot, model) {
        processorCalls++
        return {
          ...snapshot,
          processedValue: model.leaves[0]?.value,
        }
      },
    }
  ) {}

  const root = new ProcessorRoot({ leaves: [new Leaf({ value: 1 })] })
  processorCalls = 0

  root.leaves[0].setValue(2)

  expect(processorCalls).toBe(1)
  expect(getSnapshot(root)).toMatchObject({ processedValue: 2 })
  expect(processorCalls).toBe(1)
})
