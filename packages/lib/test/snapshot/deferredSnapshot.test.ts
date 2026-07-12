import { getSnapshot, Model, modelAction, prop, runUnprotected, undoMiddleware } from "../../src"
import { freezeInternalSnapshot, getInternalSnapshot } from "../../src/snapshot/internal"
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

let processorOutput: object

@testModel("deferredSnapshot/ProcessorOutputRoot")
class ProcessorOutputRoot extends Model(
  {
    value: prop(0),
  },
  {
    toSnapshotProcessor() {
      return processorOutput
    },
  }
) {}

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

test("flush after a public read keeps held snapshots immutable and shares untouched siblings", () => {
  const root = new Root({ leaves: [new Leaf({ value: 1 }), new Leaf({ value: 10 })] })

  const before = getSnapshot(root)
  root.leaves[0].setValue(2)
  const after = getSnapshot(root)

  expect(before.leaves[0].value).toBe(1)
  expect(after.leaves[0].value).toBe(2)
  expect(before).not.toBe(after)
  expect(before.leaves).not.toBe(after.leaves)
  expect(before.leaves[0]).not.toBe(after.leaves[0])
  expect(before.leaves[1]).toBe(after.leaves[1])
})

test("fused flush freezes an own-updated child before exposing its parent", () => {
  const root = new Root({ leaves: [new Leaf({ value: 1 })] })

  getSnapshot(root)
  root.leaves[0].setValue(2)
  const held = getSnapshot(root)

  root.leaves[0].setValue(3)

  expect(held.leaves[0].value).toBe(2)
  expect(getSnapshot(root).leaves[0].value).toBe(3)
})

test("freezing an internal snapshot directly still enables copy-on-write", () => {
  const root = new Root({ leaves: [new Leaf({ value: 1 })] })
  const held = getInternalSnapshot(root)!.untransformed

  freezeInternalSnapshot(held)
  root.leaves[0].setValue(2)

  expect(held.leaves[0].value).toBe(1)
  expect(getSnapshot(root).leaves[0].value).toBe(2)
})

test("fused flush freezes fresh subtrees below an own-updated insertion container", () => {
  const root = new Root({ leaves: [new Leaf({ value: 1 })] })
  const fresh = new Leaf({ value: 10 })

  getSnapshot(root)
  runUnprotected(() => {
    root.leaves.push(fresh)
    fresh.setValue(11)
  })
  const held = getSnapshot(root)

  fresh.setValue(12)

  expect(held.leaves[1].value).toBe(11)
  expect(getSnapshot(root).leaves[1].value).toBe(12)
})

test("multiple dirty children flush through the overflow path", () => {
  const root = new Root({ leaves: [new Leaf({ value: 1 }), new Leaf({ value: 10 })] })

  getSnapshot(root)
  runUnprotected(() => {
    root.leaves[0].setValue(2)
    root.leaves[1].setValue(11)
  })

  expect(getSnapshot(root).leaves).toMatchObject([{ value: 2 }, { value: 11 }])
})

test("intercept flushes leave snapshots mutable until the next public read", () => {
  const root = new Root({ leaves: [new Leaf({ value: 1 })] })

  getSnapshot(root)
  runUnprotected(() => {
    root.leaves[0].setValue(2)
    root.leaves.unshift(new Leaf({ value: 3 }))
  })
  const afterInterceptFlush = getInternalSnapshot(root.leaves)!.untransformed

  runUnprotected(() => {
    root.leaves.push(new Leaf({ value: 4 }))
  })

  expect(getInternalSnapshot(root.leaves)!.untransformed).toBe(afterInterceptFlush)
})

test("reused processor output cannot make a fused snapshot mutable", () => {
  const source = new Root({ leaves: [new Leaf({ value: 1 })] })

  getSnapshot(source)
  source.leaves[0].setValue(2)
  const sharedSnapshot = getSnapshot(source)

  processorOutput = { initial: true }
  const processor = new ProcessorOutputRoot({})
  getSnapshot(processor)

  processorOutput = sharedSnapshot
  runUnprotected(() => {
    processor.value = 1
  })
  const held = getSnapshot(processor) as typeof sharedSnapshot

  source.leaves[0].setValue(3)

  expect(held.leaves[0].value).toBe(2)
  expect(getSnapshot(source).leaves[0].value).toBe(3)
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
  const held = getSnapshot(root)
  expect(held).toMatchObject({ processedValue: 2 })
  expect(processorCalls).toBe(1)

  root.leaves[0].setValue(3)

  expect(held).toMatchObject({ processedValue: 2 })
  expect(getSnapshot(root)).toMatchObject({ processedValue: 3 })
  expect(processorCalls).toBe(2)
})
