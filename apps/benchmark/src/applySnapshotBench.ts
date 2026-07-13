import { runApplySnapshotBenchmarks } from "./applySnapshot.js"
import { runBenchSuiteToJson } from "./bench.js"

runBenchSuiteToJson(runApplySnapshotBenchmarks)
