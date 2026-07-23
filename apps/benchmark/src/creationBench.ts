import { runBenchSuiteToJson } from "./bench.js"
import { runCreationBenchmarks } from "./creation.js"

runBenchSuiteToJson(runCreationBenchmarks)
