import { writeFileSync } from "node:fs"
import { Session } from "node:inspector"
import {
  createModelHydrationProfile,
  createObservedSnapshotProfile,
  createRunUnprotectedReverseProfile,
} from "./mutations.js"

const rawIterations = Number(process.env.PROFILE_ITERATIONS ?? 100)
const iterations = Number.isSafeInteger(rawIterations) && rawIterations > 0 ? rawIterations : 100
const scenario = process.env.PROFILE_SCENARIO ?? "reverse"
const rebuildInsideBatch = process.env.PROFILE_FORCE_REBUILD === "true"
let run: () => void
switch (scenario) {
  case "model-hydration":
    run = createModelHydrationProfile()
    break
  case "observed-d32":
    run = createObservedSnapshotProfile({
      depth: 32,
      mutationsPerAction: 1,
      observeRoot: true,
      readRootAfterAction: false,
    })
    break
  case "observed-d128":
    run = createObservedSnapshotProfile({
      depth: 128,
      mutationsPerAction: 1,
      observeRoot: true,
      readRootAfterAction: false,
    })
    break
  case "batch-read-d128":
    run = createObservedSnapshotProfile({
      depth: 128,
      mutationsPerAction: 100,
      observeRoot: false,
      readRootAfterAction: true,
    })
    break
  case "read-d128":
    run = createObservedSnapshotProfile({
      depth: 128,
      mutationsPerAction: 1,
      observeRoot: false,
      readRootAfterAction: true,
    })
    break
  case "deferred-d128":
    run = createObservedSnapshotProfile({
      depth: 128,
      mutationsPerAction: 1,
      observeRoot: false,
      readRootAfterAction: false,
    })
    break
  default:
    run = createRunUnprotectedReverseProfile(rebuildInsideBatch)
}
const heapProfileOutput = process.env.PROFILE_HEAP_OUTPUT
const session = heapProfileOutput ? new Session() : undefined

run()

function inspectorPost<T>(method: string, params?: object): Promise<T> {
  return new Promise((resolve, reject) => {
    session!.post(method, params, (error, result) => {
      if (error) {
        reject(error)
      } else {
        resolve(result as T)
      }
    })
  })
}

if (session) {
  session.connect()
  await inspectorPost("HeapProfiler.startSampling", { samplingInterval: 32 * 1024 })
}

const start = performance.now()
for (let i = 0; i < iterations; i++) {
  run()
}
const elapsedMs = performance.now() - start

if (session) {
  const { profile } = await inspectorPost<{ profile: unknown }>("HeapProfiler.stopSampling")
  writeFileSync(heapProfileOutput!, `${JSON.stringify(profile)}\n`)
  session.disconnect()
}

console.log(
  JSON.stringify({
    elapsedMs,
    iterations,
    rebuildInsideBatch,
    scenario,
    opsPerSecond: (iterations / elapsedMs) * 1_000,
    heapProfileOutput,
  })
)
