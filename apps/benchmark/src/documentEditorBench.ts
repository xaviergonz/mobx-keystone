import assert from "node:assert/strict"
import { writeFileSync } from "node:fs"
import { cpus } from "node:os"
import { performance } from "node:perf_hooks"
import {
  applySnapshot,
  getSnapshot,
  ModelAutoTypeCheckingMode,
  type SnapshotInOf,
  setGlobalConfig,
} from "mobx-keystone"
import {
  type EditorDocument,
  type EditorFeatures,
  type EditorShape,
  makeEditorSnapshot,
  openEditor,
} from "./models/documentEditor.js"

function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback)
  assert(Number.isSafeInteger(value) && value > 0, `${name} must be a positive integer`)
  return value
}

const sizes = (process.env.BENCH_SIZES ?? "1000,10000,50000").split(",").map(Number)
assert(
  sizes.every((size) => Number.isSafeInteger(size) && size >= 100),
  "Sizes must be >= 100"
)
const samples = positiveInteger("BENCH_SAMPLES", 30)
const warmup = positiveInteger("BENCH_WARMUP", 5)
const typeChecking = process.env.BENCH_TYPECHECK ?? "off"
assert(typeChecking === "off" || typeChecking === "on", "BENCH_TYPECHECK must be off or on")
setGlobalConfig({
  modelAutoTypeChecking:
    typeChecking === "on"
      ? ModelAutoTypeCheckingMode.AlwaysOn
      : ModelAutoTypeCheckingMode.AlwaysOff,
})

interface Scenario {
  prepare?: () => void
  run: () => void
  verify: () => void
  counters: () => { renders: number; snapshots: number }
  dispose: () => void
}

function setupScenario(
  snapshot: SnapshotInOf<EditorDocument>,
  features: EditorFeatures,
  operation: string
): Scenario {
  let editor = openEditor(snapshot, features)
  const itemCount = editor.content.items.length
  const originalItems = operation === "open" ? [] : editor.content.items.slice()
  let beforeX = 0
  let beforeRenders = 0
  let beforeSnapshots = 0
  let rotations = 0
  let refreshVersion = 0
  let incoming = snapshot
  const refreshPercent = operation.startsWith("refresh-") ? Number(operation.split("-")[1]) : 0
  const changedCount = Math.floor((originalItems.length * refreshPercent) / 100)
  // Refresh payloads represent fresh JSON from a server, with stable IDs.
  const baseJson = operation.startsWith("refresh-")
    ? JSON.stringify(getSnapshot(editor.document))
    : ""

  return {
    prepare() {
      if (operation === "open") {
        editor.dispose()
        return
      }
      beforeX = editor.document.selection[0].current.x
      beforeRenders = editor.stats.renders
      beforeSnapshots = editor.stats.snapshots
      if (operation.startsWith("refresh-")) {
        incoming = JSON.parse(baseJson) as SnapshotInOf<EditorDocument>
        let layer = incoming.layer
        while (layer.layers && layer.layers.length > 0) layer = layer.layers[0]
        refreshVersion = refreshVersion === 1 ? 2 : 1
        for (let i = 0; i < changedCount; i++) layer.items![i].x = refreshVersion
      }
    },
    run() {
      switch (operation) {
        case "open":
          editor = openEditor(snapshot, features)
          break
        case "edit-one":
          editor.document.moveSelection(1)
          break
        case "edit-100-batched":
          editor.document.moveSelection(100)
          break
        case "edit-100-separate":
          // Same selected objects and final state, but 100 action boundaries.
          for (const ref of editor.document.selection) {
            ref.current.moveOne()
          }
          break
        case "rotate":
          editor.document.rotate(editor.content)
          break
        case "undo-redo":
          editor.document.moveSelection(100)
          editor.undo!.undo()
          editor.undo!.redo()
          break
        default:
          assert(operation.startsWith("refresh-"))
          editor.undo!.withoutUndo(() => applySnapshot(editor.document, incoming))
      }
    },
    verify() {
      assert.equal(editor.content.items.length, itemCount)
      for (const ref of editor.document.selection) assert(ref.current.attached)
      if (operation === "open") {
        assert.equal(editor.stats.renders, 1)
      } else if (operation === "rotate") {
        rotations++
        assert.equal(editor.content.items[0], originalItems[rotations % originalItems.length])
        assert.equal(editor.document.selection[0].current, originalItems[0])
      } else if (operation.startsWith("refresh-")) {
        for (let i = 0; i < originalItems.length; i++) {
          assert.equal(editor.content.items[i], originalItems[i])
          assert.equal(editor.content.items[i].x, i < changedCount ? refreshVersion : 0)
        }
        if (changedCount === 0) {
          assert.equal(editor.stats.renders, beforeRenders)
          assert.equal(editor.stats.snapshots, beforeSnapshots)
        }
      } else {
        const count = operation === "edit-one" ? 1 : 100
        for (let i = 0; i < count; i++) {
          assert.equal(editor.document.selection[i].current.x, beforeX === 0 ? 1 : 0)
        }
        const expectedNotifications =
          operation === "edit-100-separate" ? 100 : operation === "undo-redo" ? 3 : 1
        assert.equal(editor.stats.renders - beforeRenders, expectedNotifications)
        if (features === "full") {
          assert.equal(editor.stats.snapshots - beforeSnapshots, expectedNotifications)
          assert(editor.undo!.canUndo)
        }
      }
      if (features === "full") assert.equal(editor.latestSnapshot, getSnapshot(editor.document))
      assert((editor.undo?.undoLevels ?? 0) <= 20)
    },
    counters: () => ({ renders: editor.stats.renders, snapshots: editor.stats.snapshots }),
    dispose: () => editor.dispose(),
  }
}

function measure(name: string, setup: () => Scenario) {
  const scenario = setup()
  try {
    for (let i = 0; i < warmup; i++) {
      scenario.prepare?.()
      scenario.run()
      scenario.verify()
    }
    globalThis.gc?.()
    const heapBefore = process.memoryUsage().heapUsed
    const countersBefore = scenario.counters()
    const durations = []
    for (let i = 0; i < samples; i++) {
      scenario.prepare?.()
      const start = performance.now()
      scenario.run()
      durations.push(performance.now() - start)
      scenario.verify()
    }
    globalThis.gc?.()
    const heapAfter = process.memoryUsage().heapUsed
    const countersAfter = scenario.counters()
    durations.sort((a, b) => a - b)
    const medianMs =
      (durations[Math.floor((samples - 1) / 2)] + durations[Math.floor(samples / 2)]) / 2
    const p95Ms = durations[Math.ceil(samples * 0.95) - 1]
    const result = {
      name,
      samples,
      medianMs,
      p95Ms,
      minMs: durations[0],
      maxMs: durations[samples - 1],
      retainedHeapDeltaBytes: globalThis.gc ? heapAfter - heapBefore : null,
      // Opening creates a new set of observers each time, so counters are per open.
      renders: name.endsWith("/open")
        ? countersAfter.renders
        : countersAfter.renders - countersBefore.renders,
      snapshots: name.endsWith("/open")
        ? countersAfter.snapshots
        : countersAfter.snapshots - countersBefore.snapshots,
    }
    console.log(`${name}: median ${medianMs.toFixed(3)} ms, p95 ${p95Ms.toFixed(3)} ms`)
    return result
  } finally {
    scenario.dispose()
  }
}

const results = []
for (const size of sizes) {
  for (const shape of ["wide", "nested"] satisfies EditorShape[]) {
    const snapshot = makeEditorSnapshot(size, shape)
    for (const features of ["bare", "full"] satisfies EditorFeatures[]) {
      const operations =
        features === "bare"
          ? ["edit-one", "edit-100-batched"]
          : [
              "open",
              "edit-one",
              "edit-100-batched",
              "edit-100-separate",
              "rotate",
              "undo-redo",
              "refresh-0",
              "refresh-1",
              "refresh-10",
            ]
      for (const operation of operations) {
        const name = `editor/${size}/${shape}/${features}/${operation}`
        if (process.env.BENCH_FILTER && !name.includes(process.env.BENCH_FILTER)) continue
        results.push(measure(name, () => setupScenario(snapshot, features, operation)))
      }
    }
  }
}
assert(results.length > 0, "BENCH_FILTER matched no scenarios")
if (process.env.BENCH_JSON) {
  writeFileSync(
    process.env.BENCH_JSON,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        environment: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
          cpu: cpus()[0]?.model,
          nodeEnv: process.env.NODE_ENV,
          typeChecking,
          gcExposed: !!globalThis.gc,
          warmup,
        },
        results,
      },
      undefined,
      2
    )}\n`
  )
}
