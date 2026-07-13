import { writeFileSync } from "node:fs"
import { Session } from "node:inspector"
import { createRunUnprotectedReverseProfile } from "./mutations.js"

const rawIterations = Number(process.env.PROFILE_ITERATIONS ?? 100)
const iterations = Number.isSafeInteger(rawIterations) && rawIterations > 0 ? rawIterations : 100
const rebuildInsideBatch = process.env.PROFILE_FORCE_REBUILD === "true"
const run = createRunUnprotectedReverseProfile(rebuildInsideBatch)
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
    opsPerSecond: (iterations / elapsedMs) * 1_000,
    heapProfileOutput,
  })
)
