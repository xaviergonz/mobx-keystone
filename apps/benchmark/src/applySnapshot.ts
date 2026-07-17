import {
  applySnapshot,
  fromSnapshot,
  getSnapshot,
  idProp,
  Model,
  model,
  modelSnapshotInWithMetadata,
  prop,
  runUnprotected,
  tProp,
  types,
} from "mobx-keystone"
import { benchKeystone, type KeystoneBenchmarkResult } from "./bench.js"

@model("benchmark/ApplySnapshotItem")
class ApplySnapshotItem extends Model({
  id: idProp,
  a: prop(0),
  b: prop(0),
  c: prop(0),
}) {}

@model("benchmark/ApplySnapshotTypedItem")
class ApplySnapshotTypedItem extends Model({
  id: idProp,
  a: tProp(types.number, 0),
  b: tProp(types.number, 0),
  c: tProp(types.number, 0),
}) {}

@model("benchmark/ApplySnapshotRoot")
class ApplySnapshotRoot extends Model({
  items: prop<ApplySnapshotItem[]>(() => []),
}) {}

@model("benchmark/ApplySnapshotTypedRoot")
class ApplySnapshotTypedRoot extends Model({
  items: prop<ApplySnapshotTypedItem[]>(() => []),
}) {}

@model("benchmark/ApplySnapshotUnidentifiedItem")
class ApplySnapshotUnidentifiedItem extends Model({
  value: prop(0),
}) {}

@model("benchmark/ApplySnapshotUnidentifiedRoot")
class ApplySnapshotUnidentifiedRoot extends Model({
  items: prop<ApplySnapshotUnidentifiedItem[]>(() => []),
}) {}

@model("benchmark/ApplySnapshotPlainObjectRoot")
class ApplySnapshotPlainObjectRoot extends Model({
  values: prop<Record<string, number>>(() => ({})),
}) {}

function copySnapshot<T>(snapshot: T): T {
  return JSON.parse(JSON.stringify(snapshot)) as T
}

function makeSnapshot(count: number, typed: boolean) {
  const Item = typed ? ApplySnapshotTypedItem : ApplySnapshotItem
  const Root = typed ? ApplySnapshotTypedRoot : ApplySnapshotRoot
  const items = new Array(count)
  for (let i = 0; i < count; i++) {
    items[i] = modelSnapshotInWithMetadata(Item, {
      id: `item-${i}`,
      a: i,
      b: i + 1,
      c: i + 2,
    })
  }
  return modelSnapshotInWithMetadata(Root, { items })
}

function makePlainObjectSnapshot(count: number) {
  return modelSnapshotInWithMetadata(ApplySnapshotPlainObjectRoot, {
    values: Object.fromEntries(
      Array.from({ length: count }, (_, index) => [`value-${index}`, index])
    ),
  })
}

function changeEvery(snapshot: any, step: number, replacement: number): any {
  const items = snapshot.items.slice()
  for (let i = 0; i < items.length; i += step) {
    items[i] = { ...items[i], a: replacement }
  }
  return { ...snapshot, items }
}

function withInsertedItem(snapshot: any, index: number, typed: boolean): any {
  const Item = typed ? ApplySnapshotTypedItem : ApplySnapshotItem
  const items = snapshot.items.slice()
  items.splice(
    index,
    0,
    modelSnapshotInWithMetadata(Item, { id: `inserted-${index}`, a: -1, b: -1, c: -1 })
  )
  return { ...snapshot, items }
}

function addAlternatingScenario(
  name: string,
  Root: any,
  initialSnapshot: any,
  firstSnapshot: any,
  secondSnapshot: any,
  onCycle: (result: KeystoneBenchmarkResult) => void
): void {
  benchKeystone(
    name,
    () => {
      const target = fromSnapshot(Root, initialSnapshot) as object
      let useFirst = true
      return {
        run: () => {
          applySnapshot(target, useFirst ? firstSnapshot : secondSnapshot)
          useFirst = !useFirst
        },
      }
    },
    onCycle
  )
}

function addDirtyExactScenario(
  name: string,
  Root: any,
  Item: any,
  initialSnapshot: any,
  apply: boolean,
  onCycle: (result: KeystoneBenchmarkResult) => void
): void {
  benchKeystone(
    name,
    () => {
      const target = fromSnapshot(Root, initialSnapshot) as any
      const capturedSnapshot = getSnapshot(target)
      let nextTemporaryId = 0
      return {
        run: () => {
          runUnprotected(() => {
            target.items.push(
              new Item({ id: `temporary-${nextTemporaryId++}`, a: -1, b: -1, c: -1 })
            )
            target.items.pop()
          })
          if (apply) {
            applySnapshot(target, capturedSnapshot)
          }
        },
      }
    },
    onCycle
  )
}

export function runApplySnapshotBenchmarks(
  onCycle: (result: KeystoneBenchmarkResult) => void
): void {
  for (const typed of [false, true]) {
    const variant = typed ? "tProp" : "prop"
    const Root = typed ? ApplySnapshotTypedRoot : ApplySnapshotRoot
    const Item = typed ? ApplySnapshotTypedItem : ApplySnapshotItem
    const freshSnapshot = makeSnapshot(10_000, typed)
    const target = fromSnapshot(Root, freshSnapshot)
    const capturedSnapshot = getSnapshot(target)
    const freshCopy = copySnapshot(capturedSnapshot)
    const onePercentA = changeEvery(capturedSnapshot, 100, -1)
    const onePercentB = changeEvery(capturedSnapshot, 100, -2)
    const allChangedA = changeEvery(capturedSnapshot, 1, -1)
    const allChangedB = changeEvery(capturedSnapshot, 1, -2)
    const reversed = { ...capturedSnapshot, items: capturedSnapshot.items.slice().reverse() }

    benchKeystone(
      `applySnapshot/10k-${variant}-exact-captured-root`,
      () => {
        const exactTarget = fromSnapshot(Root, capturedSnapshot)
        const exactSnapshot = getSnapshot(exactTarget)
        return { run: () => applySnapshot(exactTarget, exactSnapshot) }
      },
      onCycle
    )
    benchKeystone(
      `applySnapshot/10k-${variant}-cold-control-hydrate-and-snapshot`,
      () => ({
        run: () => {
          const coldTarget = fromSnapshot(Root, capturedSnapshot)
          getSnapshot(coldTarget)
        },
      }),
      onCycle
    )
    benchKeystone(
      `applySnapshot/10k-${variant}-cold-first-exact-apply`,
      () => ({
        run: () => {
          const coldTarget = fromSnapshot(Root, capturedSnapshot)
          const coldSnapshot = getSnapshot(coldTarget)
          applySnapshot(coldTarget, coldSnapshot)
        },
      }),
      onCycle
    )
    addDirtyExactScenario(
      `applySnapshot/10k-${variant}-dirty-control-structural-roundtrip`,
      Root,
      Item,
      capturedSnapshot,
      false,
      onCycle
    )
    addDirtyExactScenario(
      `applySnapshot/10k-${variant}-dirty-exact-apply`,
      Root,
      Item,
      capturedSnapshot,
      true,
      onCycle
    )
    benchKeystone(
      `applySnapshot/10k-${variant}-fresh-copy-0pct`,
      () => {
        const copyTarget = fromSnapshot(Root, capturedSnapshot)
        return { run: () => applySnapshot(copyTarget, freshCopy) }
      },
      onCycle
    )
    addAlternatingScenario(
      `applySnapshot/10k-${variant}-shared-1pct`,
      Root,
      capturedSnapshot,
      onePercentA,
      onePercentB,
      onCycle
    )
    addAlternatingScenario(
      `applySnapshot/10k-${variant}-fresh-copy-1pct`,
      Root,
      freshCopy,
      copySnapshot(onePercentA),
      copySnapshot(onePercentB),
      onCycle
    )
    addAlternatingScenario(
      `applySnapshot/10k-${variant}-shared-100pct`,
      Root,
      capturedSnapshot,
      allChangedA,
      allChangedB,
      onCycle
    )
    addAlternatingScenario(
      `applySnapshot/10k-${variant}-reverse`,
      Root,
      capturedSnapshot,
      reversed,
      capturedSnapshot,
      onCycle
    )

    for (const [position, index] of [
      ["front", 0],
      ["middle", 5_000],
      ["end", 10_000],
    ] as const) {
      addAlternatingScenario(
        `applySnapshot/10k-${variant}-insert-delete-${position}`,
        Root,
        capturedSnapshot,
        withInsertedItem(capturedSnapshot, index, typed),
        capturedSnapshot,
        onCycle
      )
    }
  }

  const unidentifiedSnapshot = modelSnapshotInWithMetadata(ApplySnapshotUnidentifiedRoot, {
    items: Array.from({ length: 1_000 }, (_, value) =>
      modelSnapshotInWithMetadata(ApplySnapshotUnidentifiedItem, { value })
    ),
  })
  const unidentifiedChanged = {
    ...unidentifiedSnapshot,
    items: unidentifiedSnapshot.items!.map((item, index) =>
      index % 100 === 0 ? { ...item, value: -1 } : item
    ),
  }
  addAlternatingScenario(
    "applySnapshot/1k-models-without-ids-shared-1pct",
    ApplySnapshotUnidentifiedRoot,
    unidentifiedSnapshot,
    unidentifiedChanged,
    unidentifiedSnapshot,
    onCycle
  )

  const plainObjectSnapshot = makePlainObjectSnapshot(10_000)
  const plainObjectFreshCopy = copySnapshot(plainObjectSnapshot)
  benchKeystone(
    "applySnapshot/10k-plain-object-fresh-copy-0pct",
    () => {
      const target = fromSnapshot(ApplySnapshotPlainObjectRoot, plainObjectSnapshot)
      return { run: () => applySnapshot(target, plainObjectFreshCopy) }
    },
    onCycle
  )

  const primitiveArraySnapshot = Array.from({ length: 10_000 }, (_, index) => index)
  const primitiveArrayFreshCopy = copySnapshot(primitiveArraySnapshot)
  benchKeystone(
    "applySnapshot/10k-primitive-array-fresh-copy-0pct",
    () => {
      const target = fromSnapshot(primitiveArraySnapshot)
      return { run: () => applySnapshot(target, primitiveArrayFreshCopy) }
    },
    onCycle
  )
}

export type ApplySnapshotProfileScenario =
  | "prop"
  | "tProp"
  | "tProp-1pct"
  | "tProp-reverse"
  | "plain-object"

export function createFreshCopyApplyProfile(
  scenario: ApplySnapshotProfileScenario = "prop"
): () => void {
  if (scenario === "tProp-1pct" || scenario === "tProp-reverse") {
    const sourceSnapshot = makeSnapshot(10_000, true)
    const target = fromSnapshot(ApplySnapshotTypedRoot, sourceSnapshot)
    const firstSnapshot =
      scenario === "tProp-reverse"
        ? { ...sourceSnapshot, items: sourceSnapshot.items!.slice().reverse() }
        : copySnapshot(changeEvery(sourceSnapshot, 100, -1))
    const secondSnapshot =
      scenario === "tProp-reverse"
        ? sourceSnapshot
        : copySnapshot(changeEvery(sourceSnapshot, 100, -2))
    let useFirst = true
    return () => {
      applySnapshot(target, useFirst ? firstSnapshot : secondSnapshot)
      useFirst = !useFirst
    }
  }

  const [Root, sourceSnapshot] =
    scenario === "plain-object"
      ? [ApplySnapshotPlainObjectRoot, makePlainObjectSnapshot(10_000)]
      : scenario === "tProp"
        ? [ApplySnapshotTypedRoot, makeSnapshot(10_000, true)]
        : [ApplySnapshotRoot, makeSnapshot(10_000, false)]
  const target = fromSnapshot(Root, sourceSnapshot)
  const incomingSnapshot = copySnapshot(getSnapshot(target))

  return () => applySnapshot(target, incomingSnapshot)
}

export function runFreshCopyApplyProfile(
  iterations: number,
  scenario: ApplySnapshotProfileScenario = "prop"
): {
  elapsedMs: number
  iterations: number
  scenario: ApplySnapshotProfileScenario
} {
  const apply = createFreshCopyApplyProfile(scenario)
  const start = performance.now()

  for (let i = 0; i < iterations; i++) {
    apply()
  }

  return { elapsedMs: performance.now() - start, iterations, scenario }
}
