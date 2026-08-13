import { writeFileSync } from "node:fs"
import { Session } from "node:inspector"
import { type ApplySnapshotProfileScenario, createFreshCopyApplyProfile } from "./applySnapshot.js"
import {
  CREATION_PROFILE_BATCH_SIZE,
  createDataModelCacheHitProfile,
  createFlatDataModelCreationProfile,
  createFlatModelCreationProfile,
  createNestedDataModelCreationProfile,
  createNestedModelCreationProfile,
  createTypedDataModelCreationOffProfile,
  createTypedDataModelCreationProfile,
  createTypedDataModelManualTypeCheckProfile,
  createTypedDataModelTypeCheckProfile,
  createTypedModelCreationOffProfile,
  createTypedModelCreationProfile,
  createTypedModelManualTypeCheckProfile,
  createTypedModelTypeCheckProfile,
} from "./creation.js"
import {
  createDeepIndexConstructionProfile,
  createEmptyTypeCheckedModelProfile,
  createModelConstructionProfile,
  createModelHydrationProfile,
  createObservedSnapshotProfile,
  createPlainSubtreeDetachProfile,
  createRunUnprotectedReverseProfile,
} from "./mutations.js"

interface ProfileScenario {
  readonly name: string
  readonly run: () => void
  /** Number of measured operations performed by one call to run. */
  readonly workPerIteration?: number
  readonly metadata?: Readonly<Record<string, unknown>>
}

function createApplySnapshotScenario(
  name: string,
  applyScenario: ApplySnapshotProfileScenario
): ProfileScenario {
  return {
    name,
    run: createFreshCopyApplyProfile(applyScenario),
  }
}

function resolveScenario(rawScenario: string): ProfileScenario {
  const rebuildInsideBatch = process.env.PROFILE_FORCE_REBUILD === "true"

  switch (rawScenario) {
    case "reverse":
      return {
        name: rawScenario,
        run: createRunUnprotectedReverseProfile(rebuildInsideBatch),
        metadata: { rebuildInsideBatch },
      }
    case "empty-typechecked-model":
      return { name: rawScenario, run: createEmptyTypeCheckedModelProfile() }
    case "deep-index-construction":
      return { name: rawScenario, run: createDeepIndexConstructionProfile() }
    case "model-construction":
      return { name: rawScenario, run: createModelConstructionProfile() }
    case "flat-model-creation":
      return {
        name: rawScenario,
        run: createFlatModelCreationProfile(),
        workPerIteration: CREATION_PROFILE_BATCH_SIZE,
      }
    case "flat-datamodel-creation":
      return {
        name: rawScenario,
        run: createFlatDataModelCreationProfile(),
        workPerIteration: CREATION_PROFILE_BATCH_SIZE,
      }
    case "nested-model-creation":
      return {
        name: rawScenario,
        run: createNestedModelCreationProfile(),
        workPerIteration: CREATION_PROFILE_BATCH_SIZE,
      }
    case "nested-datamodel-creation":
      return {
        name: rawScenario,
        run: createNestedDataModelCreationProfile(),
        workPerIteration: CREATION_PROFILE_BATCH_SIZE,
      }
    case "typed-model-creation":
      return {
        name: rawScenario,
        run: createTypedModelCreationProfile(),
        workPerIteration: CREATION_PROFILE_BATCH_SIZE,
      }
    case "typed-model-creation-off":
      return {
        name: rawScenario,
        run: createTypedModelCreationOffProfile(),
        workPerIteration: CREATION_PROFILE_BATCH_SIZE,
      }
    case "typed-datamodel-creation":
      return {
        name: rawScenario,
        run: createTypedDataModelCreationProfile(),
        workPerIteration: CREATION_PROFILE_BATCH_SIZE,
      }
    case "typed-datamodel-creation-off":
      return {
        name: rawScenario,
        run: createTypedDataModelCreationOffProfile(),
        workPerIteration: CREATION_PROFILE_BATCH_SIZE,
      }
    case "typed-model-manual-typecheck":
      return {
        name: rawScenario,
        run: createTypedModelManualTypeCheckProfile(),
        workPerIteration: CREATION_PROFILE_BATCH_SIZE,
      }
    case "typed-datamodel-manual-typecheck":
      return {
        name: rawScenario,
        run: createTypedDataModelManualTypeCheckProfile(),
        workPerIteration: CREATION_PROFILE_BATCH_SIZE,
      }
    case "typed-model-typecheck-only":
      return {
        name: rawScenario,
        run: createTypedModelTypeCheckProfile(),
        workPerIteration: CREATION_PROFILE_BATCH_SIZE,
      }
    case "typed-datamodel-typecheck-only":
      return {
        name: rawScenario,
        run: createTypedDataModelTypeCheckProfile(),
        workPerIteration: CREATION_PROFILE_BATCH_SIZE,
      }
    case "datamodel-cache-hit":
      return {
        name: rawScenario,
        run: createDataModelCacheHitProfile(),
        workPerIteration: CREATION_PROFILE_BATCH_SIZE,
      }
    case "plain-subtree-detach":
      return { name: rawScenario, run: createPlainSubtreeDetachProfile() }
    case "model-hydration":
      return { name: rawScenario, run: createModelHydrationProfile() }
    case "observed-d32":
      return {
        name: rawScenario,
        run: createObservedSnapshotProfile({
          depth: 32,
          mutationsPerAction: 1,
          observeRoot: true,
          readRootAfterAction: false,
        }),
      }
    case "observed-d128":
      return {
        name: rawScenario,
        run: createObservedSnapshotProfile({
          depth: 128,
          mutationsPerAction: 1,
          observeRoot: true,
          readRootAfterAction: false,
        }),
      }
    case "batch-read-d128":
      return {
        name: rawScenario,
        run: createObservedSnapshotProfile({
          depth: 128,
          mutationsPerAction: 100,
          observeRoot: false,
          readRootAfterAction: true,
        }),
      }
    case "read-d128":
      return {
        name: rawScenario,
        run: createObservedSnapshotProfile({
          depth: 128,
          mutationsPerAction: 1,
          observeRoot: false,
          readRootAfterAction: true,
        }),
      }
    case "deferred-d128":
      return {
        name: rawScenario,
        run: createObservedSnapshotProfile({
          depth: 128,
          mutationsPerAction: 1,
          observeRoot: false,
          readRootAfterAction: false,
        }),
      }
    case "apply-prop":
    case "prop":
      return createApplySnapshotScenario("apply-prop", "prop")
    case "apply-tprop":
    case "tProp":
      return createApplySnapshotScenario("apply-tprop", "tProp")
    case "apply-tprop-1pct":
    case "tProp-1pct":
      return createApplySnapshotScenario("apply-tprop-1pct", "tProp-1pct")
    case "apply-tprop-reverse":
    case "tProp-reverse":
      return createApplySnapshotScenario("apply-tprop-reverse", "tProp-reverse")
    case "apply-plain-object":
    case "plain-object":
      return createApplySnapshotScenario("apply-plain-object", "plain-object")
    default:
      throw new Error(`unknown profile scenario: ${rawScenario}`)
  }
}

function readIterations(): number {
  const rawIterations = Number(process.env.PROFILE_ITERATIONS ?? 100)
  return Number.isSafeInteger(rawIterations) && rawIterations > 0 ? rawIterations : 100
}

function inspectorPost<T>(session: Session, method: string, params?: object): Promise<T> {
  return new Promise((resolve, reject) => {
    session.post(method, params, (error, result) => {
      if (error) {
        reject(error)
      } else {
        resolve(result as T)
      }
    })
  })
}

const rawScenario = process.env.PROFILE_SCENARIO ?? process.argv[2] ?? "reverse"
const scenario = resolveScenario(rawScenario)
const iterations = readIterations()
const heapProfileOutput = process.env.PROFILE_HEAP_OUTPUT
const session = heapProfileOutput ? new Session() : undefined

// Warm lazy indexes and reconciliation/type-check caches before measuring the
// steady-state profile path.
scenario.run()

if (session) {
  session.connect()
  await inspectorPost(session, "HeapProfiler.startSampling", { samplingInterval: 32 * 1024 })
}

const start = performance.now()
for (let i = 0; i < iterations; i++) {
  scenario.run()
}
const elapsedMs = performance.now() - start
const iterationsPerSecond = (iterations / elapsedMs) * 1_000
const workPerIteration = scenario.workPerIteration ?? 1

if (session) {
  const { profile } = await inspectorPost<{ profile: unknown }>(
    session,
    "HeapProfiler.stopSampling"
  )
  writeFileSync(heapProfileOutput!, `${JSON.stringify(profile)}\n`)
  session.disconnect()
}

console.log(
  JSON.stringify({
    elapsedMs,
    iterations,
    scenario: scenario.name,
    iterationsPerSecond,
    workPerIteration,
    opsPerSecond: iterationsPerSecond * workPerIteration,
    heapProfileOutput,
    ...scenario.metadata,
  })
)
