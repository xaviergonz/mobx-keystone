import {
  fromSnapshot,
  getSnapshot,
  Model,
  ModelAutoTypeCheckingMode,
  model,
  onDeepChange,
  onPatches,
  onSnapshot,
  prop,
  runUnprotected,
  setGlobalConfig,
  tProp,
  types,
} from "mobx-keystone"
import {
  benchKeystone,
  type KeystoneBenchmarkResult,
  type KeystoneBenchmarkSetup,
} from "./bench.js"

@model("benchmark/MutationNode")
class MutationNode extends Model({
  value: prop(0),
  child: prop<MutationNode | undefined>(),
  other: prop<MutationNode | undefined>(),
}) {}

@model("benchmark/MutationList")
class MutationList extends Model({
  values: prop<number[]>(() => []),
}) {}

@model("benchmark/TypedMutationNode")
class TypedMutationNode extends Model({
  value: tProp(types.number, 0),
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

function addMutationScenario(
  name: string,
  setup: () => KeystoneBenchmarkSetup,
  onCycle: (result: KeystoneBenchmarkResult) => void
): void {
  benchKeystone(name, setup, onCycle)
}

export function runMutationBenchmarks(onCycle: (result: KeystoneBenchmarkResult) => void): void {
  {
    const { leaf } = makeDepth(1)
    addMutationScenario("shallow-mutate-no-listener", () => ({ run: () => mutate(leaf) }), onCycle)
  }
  addMutationScenario(
    "shallow-mutate-patch-listener",
    () => {
      const { root, leaf } = makeDepth(1)
      return { run: () => mutate(leaf), dispose: onPatches(root, () => {}) }
    },
    onCycle
  )
  addMutationScenario(
    "shallow-mutate-deep-change-listener",
    () => {
      const { root, leaf } = makeDepth(1)
      return { run: () => mutate(leaf), dispose: onDeepChange(root, () => {}) }
    },
    onCycle
  )
  addMutationScenario(
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
    addMutationScenario(
      `deep-mutate-d${depth}-no-listener`,
      () => {
        const { leaf } = makeDepth(depth)
        return { run: () => mutate(leaf) }
      },
      onCycle
    )
  }

  for (const depth of [8, 32, 128]) {
    addMutationScenario(
      `deep-mutate-d${depth}-root-onSnapshot`,
      () => {
        const { root, leaf } = makeDepth(depth)
        return { run: () => mutate(leaf), dispose: onSnapshot(root, () => {}) }
      },
      onCycle
    )
  }
  addMutationScenario(
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
    addMutationScenario(
      "fromSnapshot-2000-item-list",
      () => ({
        run: () => {
          fromSnapshot(MutationList, snapshot)
        },
      }),
      onCycle
    )
  }
  addMutationScenario(
    "typed-mutate-typecheck-on",
    () => {
      setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn })
      const node = new TypedMutationNode({})
      return {
        run: () => {
          runUnprotected(() => {
            node.value = node.value === 0 ? 1 : 0
          })
        },
        dispose: () => {
          setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff })
        },
      }
    },
    onCycle
  )
}
