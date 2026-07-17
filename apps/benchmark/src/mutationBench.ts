import { runBenchSuiteToJson } from "./bench.js"
import { runMutationBenchmarks } from "./mutations.js"

runBenchSuiteToJson(runMutationBenchmarks)
