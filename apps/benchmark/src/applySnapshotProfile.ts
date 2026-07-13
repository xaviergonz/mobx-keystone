import { writeFileSync } from "node:fs"
import { Session } from "node:inspector"
import { type ApplySnapshotProfileScenario, createFreshCopyApplyProfile } from "./applySnapshot.js"

const rawIterations = Number(process.env.PROFILE_ITERATIONS ?? 100)
const iterations = Number.isSafeInteger(rawIterations) && rawIterations > 0 ? rawIterations : 100
const rawScenario = process.env.PROFILE_SCENARIO
const scenario: ApplySnapshotProfileScenario =
  rawScenario === "tProp" ||
  rawScenario === "tProp-1pct" ||
  rawScenario === "tProp-reverse" ||
  rawScenario === "plain-object"
    ? rawScenario
    : "prop"
const apply = createFreshCopyApplyProfile(scenario)
const heapProfileOutput = process.env.PROFILE_HEAP_OUTPUT
const session = heapProfileOutput ? new Session() : undefined

// Build lazy indexes and initialize reconciliation caches before measuring the
// steady-state apply path.
apply()

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
  apply()
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
    scenario,
    opsPerSecond: (iterations / elapsedMs) * 1_000,
    heapProfileOutput,
  })
)
