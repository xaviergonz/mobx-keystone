import { writeFileSync } from "node:fs"
import type { KeystoneBenchmarkResult } from "./bench.js"
import { runMutationBenchmarks } from "./mutations.js"

const results: Array<{ readonly schemaVersion: 1 } & KeystoneBenchmarkResult> = []

runMutationBenchmarks((result) => {
  results.push({ schemaVersion: 1, ...result })
})

if (process.env.BENCH_JSON) {
  writeFileSync(process.env.BENCH_JSON, `${JSON.stringify(results, undefined, 2)}\n`)
}
