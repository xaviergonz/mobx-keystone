import {
  applyPatches,
  arrayActions,
  fromSnapshot,
  getChildrenObjects,
  getSnapshot,
  idProp,
  Model,
  ModelAutoTypeCheckingMode,
  model,
  modelAction,
  onDeepChange,
  onPatches,
  onSnapshot,
  prop,
  runUnprotected,
  setGlobalConfig,
  tProp,
  types,
} from "mobx-keystone"
import { benchKeystone, type KeystoneBenchmarkResult } from "./bench.js"
import { TcBigModel } from "./models/ks-typeChecked.js"

@model("benchmark/MutationNode")
class MutationNode extends Model({
  value: prop(0),
  child: prop<MutationNode | undefined>(),
  other: prop<MutationNode | undefined>(),
}) {
  @modelAction
  noOp() {}

  @modelAction
  toggleValue() {
    this.value = this.value === 0 ? 1 : 0
  }
}

@model("benchmark/MutationList")
class MutationList extends Model({
  values: prop<number[]>(() => []),
}) {}

@model("benchmark/PlainSubtreeHolder")
class PlainSubtreeHolder extends Model({
  value: prop<any[]>(() => []),
}) {}

@model("benchmark/MutationActionItem")
class MutationActionItem extends Model({ id: idProp }) {}

@model("benchmark/MutationActionList")
class MutationActionList extends Model({ items: prop<MutationActionItem[]>(() => []) }) {
  @modelAction
  rotateFirstToEnd() {
    this.items.push(this.items.shift()!)
  }
}

@model("benchmark/TypedMutationNode")
class TypedMutationNode extends Model({
  value: tProp(types.number, 0),
}) {}

@model("benchmark/TypedMediumMutationNode")
class TypedMediumMutationNode extends Model({
  a: tProp(types.number, 0),
  b: tProp(types.number, 0),
  c: tProp(types.number, 0),
  d: tProp(types.number, 0),
}) {}

@model("benchmark/TypedWideMutationNode")
class TypedWideMutationNode extends Model({
  a: tProp(types.number, 0),
  b: tProp(types.number, 0),
  c: tProp(types.number, 0),
  d: tProp(types.number, 0),
  e: tProp(types.number, 0),
  f: tProp(types.number, 0),
  g: tProp(types.number, 0),
  h: tProp(types.number, 0),
}) {}

@model("benchmark/TypedTupleMutationNode")
class TypedTupleMutationNode extends Model({
  value: tProp(
    types.tuple(
      types.number,
      types.number,
      types.number,
      types.number,
      types.number,
      types.number,
      types.number,
      types.number
    ),
    () =>
      [0, 0, 0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number, number, number]
  ),
}) {}

@model("benchmark/TypedArrayMutationNode")
class TypedArrayMutationNode extends Model({
  value: tProp(types.array(types.number), () => [0, 0, 0, 0, 0, 0, 0, 0]),
}) {}

@model("benchmark/TypedRecordMutationNode")
class TypedRecordMutationNode extends Model({
  value: tProp(types.record(types.number), () => ({
    a: 0,
    b: 0,
    c: 0,
    d: 0,
    e: 0,
    f: 0,
    g: 0,
    h: 0,
  })),
}) {}

function makeDepth(depth: number): { root: MutationNode; leaf: MutationNode } {
  let leaf = new MutationNode({})
  for (let i = 1; i < depth; i++) {
    leaf = new MutationNode({ child: leaf })
  }
  return { root: leaf, leaf: getLeaf(leaf) }
}

function getLeaf(root: MutationNode): MutationNode {
  let current = root
  while (current.child) {
    current = current.child
  }
  return current
}

function mutate(node: MutationNode): void {
  runUnprotected(() => {
    node.value = node.value === 0 ? 1 : 0
  })
}

export function createRunUnprotectedReverseProfile(rebuildInsideBatch: boolean): () => void {
  const root = new MutationActionList({
    items: Array.from({ length: 10_000 }, () => new MutationActionItem({})),
  })
  getChildrenObjects(root, { deep: true })

  return () => {
    runUnprotected(() => {
      root.items.reverse()
      if (rebuildInsideBatch) {
        getChildrenObjects(root, { deep: true })
      }
    })
    getChildrenObjects(root, { deep: true })
  }
}

export function createObservedSnapshotProfile(options: {
  depth: number
  mutationsPerAction: number
  observeRoot: boolean
  readRootAfterAction: boolean
}): () => void {
  const { root, leaf } = makeDepth(options.depth)
  const dispose = options.observeRoot ? onSnapshot(root, () => {}) : undefined

  return () => {
    runUnprotected(() => {
      for (let i = 0; i < options.mutationsPerAction; i++) {
        leaf.value = leaf.value === 0 ? 1 : 0
      }
    })

    if (options.readRootAfterAction) {
      getSnapshot(root)
    }

    // Keep the reaction alive for the lifetime of the profile closure. This
    // branch is unreachable, but makes its ownership explicit to TypeScript.
    void dispose
  }
}

/** Repeated direct construction of the same model-tree shape used by hydration. */
export function createModelConstructionProfile(): () => void {
  const ids = Array.from({ length: 2_000 }, (_, index) => `item-${index}`)

  return () => {
    const items = new Array<MutationActionItem>(ids.length)
    for (let i = 0; i < ids.length; i++) {
      items[i] = new MutationActionItem({ id: ids[i] })
    }
    new MutationActionList({ items })
  }
}

/** Repeated construction followed by first-time materialization of the deep-child index. */
export function createDeepIndexConstructionProfile(): () => void {
  const ids = Array.from({ length: 2_000 }, (_, index) => `item-${index}`)

  return () => {
    const items = new Array<MutationActionItem>(ids.length)
    for (let i = 0; i < ids.length; i++) {
      items[i] = new MutationActionItem({ id: ids[i] })
    }
    const root = new MutationActionList({ items })
    getChildrenObjects(root, { deep: true })
  }
}

/** Repeated recursive untweaking and retweaking of a plain-object/array subtree. */
export function createPlainSubtreeDetachProfile(): () => void {
  const value = Array.from({ length: 1_000 }, (_, index) => ({
    child: { value: index },
    values: [index, index + 1],
  }))
  const root = new PlainSubtreeHolder({ value })

  return () => {
    runUnprotected(() => {
      const oldValue = root.value
      root.value = []
      root.value = oldValue
    })
  }
}

/**
 * Repeated model hydration for CPU and allocation profiling. This intentionally
 * uses the same shape as the model-list benchmark below, rather than the
 * primitive-list control.
 */
export function createModelHydrationProfile(): () => void {
  const snapshot = {
    items: Array.from({ length: 2_000 }, (_, index) => ({
      $modelType: "benchmark/MutationActionItem",
      id: `item-${index}`,
    })),
  }

  return () => {
    fromSnapshot(MutationActionList, snapshot)
  }
}

/** Repeated construction of an empty model with a wide runtime type schema. */
export function createEmptyTypeCheckedModelProfile(): () => void {
  setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn })
  return () => {
    new TcBigModel({})
  }
}

export function runMutationBenchmarks(onCycle: (result: KeystoneBenchmarkResult) => void): void {
  const benchTypeCheckAlwaysOn = (name: string, createRun: () => () => void): void => {
    benchKeystone(
      name,
      () => {
        setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn })
        try {
          return {
            run: createRun(),
            dispose: () => {
              setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff })
            },
          }
        } catch (error) {
          setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff })
          throw error
        }
      },
      onCycle
    )
  }

  benchKeystone(
    "model-action-noop",
    () => {
      const node = new MutationNode({})
      return { run: () => node.noOp() }
    },
    onCycle
  )
  benchKeystone(
    "model-action-scalar",
    () => {
      const node = new MutationNode({})
      return { run: () => node.toggleValue() }
    },
    onCycle
  )
  benchKeystone("run-unprotected-noop", () => ({ run: () => runUnprotected(() => {}) }), onCycle)
  benchKeystone(
    "run-unprotected-scalar",
    () => {
      const node = new MutationNode({})
      return {
        run: () => {
          runUnprotected(() => {
            node.value = node.value === 0 ? 1 : 0
          })
        },
      }
    },
    onCycle
  )
  benchKeystone(
    "array-update-no-listener",
    () => {
      const root = new MutationList({ values: [0] })
      return {
        run: () => {
          runUnprotected(() => {
            root.values[0] = root.values[0] === 0 ? 1 : 0
          })
        },
      }
    },
    onCycle
  )
  benchKeystone(
    "array-action-swap-1k-models",
    () => {
      const root = new MutationActionList({
        items: Array.from({ length: 1_000 }, () => new MutationActionItem({})),
      })
      getChildrenObjects(root, { deep: true })
      return {
        run: () => {
          arrayActions.swap(root.items, 0, root.items.length - 1)
          getChildrenObjects(root, { deep: true })
        },
      }
    },
    onCycle
  )
  benchKeystone(
    "apply-patches-move-1k-models",
    () => {
      const root = new MutationActionList({
        items: Array.from({ length: 1_000 }, () => new MutationActionItem({})),
      })
      const firstSnapshot = getSnapshot(root.items[0])
      const secondSnapshot = getSnapshot(root.items[1])
      let moveFirst = true
      getChildrenObjects(root, { deep: true })
      return {
        run: () => {
          applyPatches(root, [
            { op: "remove", path: ["items", 0] },
            {
              op: "add",
              path: ["items", 1],
              value: moveFirst ? firstSnapshot : secondSnapshot,
            },
          ])
          moveFirst = !moveFirst
          getChildrenObjects(root, { deep: true })
        },
      }
    },
    onCycle
  )
  benchKeystone(
    "model-action-rotate-1k-models",
    () => {
      const root = new MutationActionList({
        items: Array.from({ length: 1_000 }, () => new MutationActionItem({})),
      })
      getChildrenObjects(root, { deep: true })
      return {
        run: () => {
          root.rotateFirstToEnd()
          getChildrenObjects(root, { deep: true })
        },
      }
    },
    onCycle
  )
  benchKeystone(
    "run-unprotected-rotate-1k-models",
    () => {
      const root = new MutationActionList({
        items: Array.from({ length: 1_000 }, () => new MutationActionItem({})),
      })
      getChildrenObjects(root, { deep: true })
      return {
        run: () => {
          runUnprotected(() => {
            root.items.push(root.items.shift()!)
          })
          getChildrenObjects(root, { deep: true })
        },
      }
    },
    onCycle
  )
  benchKeystone(
    "run-unprotected-reverse-10k-models",
    () => {
      const run = createRunUnprotectedReverseProfile(false)
      return { run }
    },
    onCycle
  )
  benchKeystone(
    "run-unprotected-replace-10k-primitives-no-listener",
    () => {
      const initial = Array.from({ length: 10_000 }, (_, index) => index)
      const root = new MutationList({ values: initial })
      const replacement = Array.from({ length: 10_000 }, (_, index) => -index)
      let useInitial = false
      return {
        run: () => {
          runUnprotected(() => {
            const next = useInitial ? initial : replacement
            root.values.splice(0, root.values.length, ...next)
            useInitial = !useInitial
          })
        },
      }
    },
    onCycle
  )
  benchKeystone(
    "run-unprotected-replace-10k-primitives-patch-listener",
    () => {
      const initial = Array.from({ length: 10_000 }, (_, index) => index)
      const root = new MutationList({ values: initial })
      const replacement = Array.from({ length: 10_000 }, (_, index) => -index)
      let useInitial = false
      return {
        run: () => {
          runUnprotected(() => {
            const next = useInitial ? initial : replacement
            root.values.splice(0, root.values.length, ...next)
            useInitial = !useInitial
          })
        },
        dispose: onPatches(root, () => {}),
      }
    },
    onCycle
  )

  {
    const { leaf } = makeDepth(1)
    benchKeystone("shallow-mutate-no-listener", () => ({ run: () => mutate(leaf) }), onCycle)
  }
  benchKeystone(
    "shallow-mutate-patch-listener",
    () => {
      const { root, leaf } = makeDepth(1)
      return { run: () => mutate(leaf), dispose: onPatches(root, () => {}) }
    },
    onCycle
  )
  benchKeystone(
    "shallow-mutate-deep-change-listener",
    () => {
      const { root, leaf } = makeDepth(1)
      return { run: () => mutate(leaf), dispose: onDeepChange(root, () => {}) }
    },
    onCycle
  )
  benchKeystone(
    "shallow-mutate-unrelated-subtree-listener",
    () => {
      const { root, leaf } = makeDepth(1)
      const other = new MutationNode({})
      runUnprotected(() => {
        root.other = other
      })
      return { run: () => mutate(leaf), dispose: onDeepChange(other, () => {}) }
    },
    onCycle
  )

  for (const depth of [8, 32, 128]) {
    benchKeystone(
      `deep-mutate-d${depth}-no-listener`,
      () => {
        const { leaf } = makeDepth(depth)
        return { run: () => mutate(leaf) }
      },
      onCycle
    )
  }

  for (const depth of [8, 32, 128]) {
    benchKeystone(
      `deep-mutate-d${depth}-root-onSnapshot`,
      () => {
        const { root, leaf } = makeDepth(depth)
        return { run: () => mutate(leaf), dispose: onSnapshot(root, () => {}) }
      },
      onCycle
    )
  }
  benchKeystone(
    "bulk-mutate-100-in-one-action-d128",
    () => {
      const { root, leaf } = makeDepth(128)
      return {
        run: () => {
          runUnprotected(() => {
            for (let i = 0; i < 100; i++) {
              leaf.value = leaf.value === 0 ? 1 : 0
            }
            getSnapshot(root)
          })
        },
      }
    },
    onCycle
  )

  {
    const snapshot = { values: Array.from({ length: 2000 }, (_, index) => index) }
    benchKeystone(
      "fromSnapshot-2000-item-list",
      () => ({
        run: () => {
          fromSnapshot(MutationList, snapshot)
        },
      }),
      onCycle
    )
  }
  {
    const ids = Array.from({ length: 2000 }, (_, index) => `item-${index}`)
    benchKeystone(
      "new-2000-item-model-list",
      () => ({
        run: () => {
          const items = new Array<MutationActionItem>(ids.length)
          for (let i = 0; i < ids.length; i++) {
            items[i] = new MutationActionItem({ id: ids[i] })
          }
          new MutationActionList({ items })
        },
      }),
      onCycle
    )
  }
  {
    const snapshot = {
      items: Array.from({ length: 2000 }, (_, index) => ({
        $modelType: "benchmark/MutationActionItem",
        id: `item-${index}`,
      })),
    }
    benchKeystone(
      "fromSnapshot-2000-item-model-list",
      () => ({
        run: () => {
          fromSnapshot(MutationActionList, snapshot)
        },
      }),
      onCycle
    )
  }
  benchTypeCheckAlwaysOn("typed-mutate-typecheck-on", () => {
    const node = new TypedMutationNode({})
    return () => {
      runUnprotected(() => {
        node.value = node.value === 0 ? 1 : 0
      })
    }
  })
  benchTypeCheckAlwaysOn("typed-medium-mutate-typecheck-on", () => {
    const node = new TypedMediumMutationNode({})
    return () => {
      runUnprotected(() => {
        node.a = node.a === 0 ? 1 : 0
      })
    }
  })
  benchTypeCheckAlwaysOn("typed-wide-mutate-typecheck-on", () => {
    const node = new TypedWideMutationNode({})
    return () => {
      runUnprotected(() => {
        node.a = node.a === 0 ? 1 : 0
      })
    }
  })
  benchTypeCheckAlwaysOn("typed-tuple-creation-typecheck-on", () => {
    return () => {
      new TypedTupleMutationNode({})
    }
  })
  benchTypeCheckAlwaysOn("typed-tuple-mutate-typecheck-on", () => {
    const node = new TypedTupleMutationNode({})
    return () => {
      runUnprotected(() => {
        node.value[0] = node.value[0] === 0 ? 1 : 0
      })
    }
  })
  benchTypeCheckAlwaysOn("typed-array-creation-typecheck-on", () => {
    return () => {
      new TypedArrayMutationNode({})
    }
  })
  benchTypeCheckAlwaysOn("typed-array-mutate-typecheck-on", () => {
    const node = new TypedArrayMutationNode({})
    return () => {
      runUnprotected(() => {
        node.value[0] = node.value[0] === 0 ? 1 : 0
      })
    }
  })
  benchTypeCheckAlwaysOn("typed-record-creation-typecheck-on", () => {
    return () => {
      new TypedRecordMutationNode({})
    }
  })
  benchTypeCheckAlwaysOn("typed-record-mutate-typecheck-on", () => {
    const node = new TypedRecordMutationNode({})
    return () => {
      runUnprotected(() => {
        node.value.a = node.value.a === 0 ? 1 : 0
      })
    }
  })
}
