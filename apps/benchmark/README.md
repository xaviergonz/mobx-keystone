# Document editor benchmarks

Build from the repository root, then run the scenario suite:

```sh
pnpm benchmark:build
pnpm --dir apps/benchmark bench:editor
```

This is a separate suite from `bench`, `bench:mutations`, and `bench:apply-snapshot`.
It uses one reusable fixture in `src/models/documentEditor.ts` and reports median,
p95, minimum, and maximum milliseconds per operation. JSON includes environment
metadata, reaction counts, snapshot notification counts, and retained heap growth.

## Workloads

Each document contains 1k, 10k, or 50k content models with IDs, titles, positions,
visibility defaults, and root-store attachment hooks. A selection of 100 root
references is spread evenly across the document. An autorun represents an inspector
reading the selected objects' positions. The `wide` shape has one content layer;
`nested` adds eight enclosing layers, each with a child-layer array. These are two
controlled shapes, not a simulation of every possible editor tree.

`bare` enables the inspector, references, and hooks. `full` additionally enables
undo (20 history entries) and root snapshot observation representing autosave
scheduling. Autosave materializes snapshots but does not serialize JSON, write to
storage, or perform network I/O. Rendering means the inspector autorun, not DOM work.

| Operation | Timed work |
| --- | --- |
| `open` | Hydrate, register the root store, run hooks, resolve observed references, initialize inspector, snapshot observation and undo |
| `edit-one` | Toggle the first selected object's x/y in one action; bare/full comparison |
| `edit-100-batched` | Toggle all selected objects' x/y in one action; bare/full comparison |
| `edit-100-separate` | Same edits across 100 actions, including each action's notifications/history |
| `rotate` | Move the first content model to the end of the list, with undo and observers |
| `undo-redo` | Edit 100 objects, undo that edit, then redo it; reports the combined cycle |
| `refresh-0`, `refresh-1`, `refresh-10` | Apply freshly parsed server snapshots with 0%, 1%, or 10% of content models changed, preserving IDs; excludes undo recording |

Setup, refresh payload parsing, previous-document disposal, and correctness checks
are outside the operation timer. Synchronous reactions and snapshot callbacks are
inside it. Refresh payload values alternate so repeated samples remain real changes;
the 0% case deliberately measures a no-op. Every iteration checks relevant outcomes,
including attachment, reference resolution, model identity, notification counts,
snapshot freshness, and the history limit. These assertions also warm caches between
samples; this is a steady-state suite, not a cold-start/JIT benchmark.

## Controls

```sh
# Quick complete smoke run (too few samples for performance conclusions)
BENCH_SIZES=1000 BENCH_SAMPLES=3 BENCH_WARMUP=1 pnpm --dir apps/benchmark bench:editor

# Compare editing across all default sizes/shapes, and save machine-readable results
BENCH_FILTER=edit- BENCH_SAMPLES=100 BENCH_WARMUP=25 BENCH_JSON=/tmp/editor.json pnpm --dir apps/benchmark bench:editor

# Exercise longer editing sessions and history eviction
BENCH_SIZES=10000 BENCH_FILTER=wide/full/edit-100-batched BENCH_SAMPLES=1000 pnpm --dir apps/benchmark bench:editor

# Separate runtime type-checking comparison (content scalar props use tProp)
BENCH_TYPECHECK=on BENCH_SIZES=1000 pnpm --dir apps/benchmark bench:editor

# CPU/allocation sampling for one scenario; includes setup and verification work
NODE_ENV=production BENCH_SIZES=10000 BENCH_FILTER=wide/full/edit-100-batched node --expose-gc --cpu-prof --heap-prof --cpu-prof-dir=/tmp --heap-prof-dir=/tmp apps/benchmark/dist/documentEditorBench.js
```

`BENCH_SIZES` is a comma-separated list of integers >= 100. `BENCH_FILTER` matches
a substring of `editor/<size>/<shape>/<features>/<operation>`. Defaults are 30 timed
samples and 5 warmup iterations per scenario. `BENCH_TYPECHECK` accepts `off` (default)
or `on`. Samples are individual operations, not Benchmark.js throughput samples;
the JSON format is separate from the existing throughput suites.

`bench:editor` runs Node in production mode with explicit GC available. GC runs
after warmup and after measurement, outside the timer. Natural GC during operations
remains included in latency. `retainedHeapDeltaBytes` is the post-GC change over the
measured iterations with the final fixture still live. It includes history growth,
caches, runner data, and measurement noise; it is **not total allocation, peak memory,
or proof of a leak**. It may be negative, and is null when running without exposed GC.
For stable full-history comparisons, use at least 20 warmup iterations. Opening
reports the final document's observer counts; other scenarios report totals across
measured operations.

Repeat comparisons on the same idle machine and Node version. Use more samples for
p95 conclusions and CPU/heap profiles to locate causes before changing internals.
Yjs/Loro binding throughput, cross-parent subtree moves, and document-release leak
checks are not yet covered by this suite.

## Array reindexing optimization

On Node 24.18.0 / Apple M1 Max, rebuilding the production bundle between runs,
the `rotate` scenario measured the following medians (150 samples after 20 warmup
iterations, with undo, root snapshot observation, references, and inspector enabled).
The baseline is one run; optimized values are the medians of three runs:

| Content models / shape | Before | After | Time reduction |
| --- | --- | --- | --- |
| 10k / wide | 3.212 ms | 2.324 ms | 28% |
| 10k / nested | 3.415 ms | 2.262 ms | 34% |
| 50k / wide | 18.923 ms | 14.744 ms | 22% |
| 50k / nested | 20.237 ms | 14.483 ms | 28% |

The change replaces one general parent-assignment action per remaining element
with one action that updates the unchanged array tail's paths. It also removes
the now-unused index-change flag from general parent assignment. It adds no
cache or persistent metadata. All three optimized runs improved all four cases;
the exact timings remain sensitive to GC and machine load.

Reproduce with `BENCH_SIZES=10000,50000 BENCH_FILTER=/rotate BENCH_SAMPLES=150
BENCH_WARMUP=20` using `bench:editor`. CPU profiles identified parent assignment
and the splice interceptor as the main library-side costs for this workload.

## Hydration with defaults

`bench:creation` also includes `model-hydrate-2k-defaults`,
`model-hydrate-2k-provided`, and `model-hydrate-2k-nested-defaults`. Each operation
hydrates 2,000 identified models and materializes their snapshot. The first two
cases use the same eight primitive fields, either omitted or supplied. The third
checks object and array defaults as a control. Snapshot construction is outside
the timer, and automatic type checking is disabled.

```sh
pnpm benchmark:build
BENCH_FILTER=model-hydrate BENCH_MIN_SAMPLES=30 BENCH_MAX_TIME=1 BENCH_JSON=/tmp/hydration.json pnpm --dir apps/benchmark bench:creation
```

Updating the existing primitive initialization snapshot when applying defaults
or regenerated IDs avoids rebuilding that snapshot from observable properties.
The existing initialization WeakMap now stores snapshots directly, removing its
per-model metadata record and flags; structured data uses the general tweaker.

Paired production-bundle runs on Node 24.18.0 / Apple M1 Max measured:

| Hydration case | Before (operations/s) | After (operations/s) |
| --- | --- | --- |
| Primitive defaults | 37.18 ±3.15% | 49.14 ±4.18% |
| Supplied primitive fields | 45.84 ±4.98% | 44.69 ±4.46% |
| Object/array defaults | 25.99 ±6.11% | 26.48 ±6.06% |

That is about 32% higher throughput (24% less time) for primitive defaults, with
the controls within measurement noise. Two editor `open` comparisons at 10k
models, using 40 samples after 10 warmup iterations, averaged about 13% less time
for the wide document and 9% less for the nested document. Loading remains
GC-sensitive, and these figures are local measurements rather than guarantees.

## Snapshot refresh traversal

Reconciliation now reads internal snapshots for comparisons, avoiding public
snapshot freezing and observation setup for every visited node. It still flushes
pending child changes before comparing and preserves public snapshot immutability.
This uses existing metadata, with no new cache or invalidation rules.

A paired production-bundle run on Node 24.18.0 / Apple M1 Max measured these
medians for 10,000-item documents, with 100 samples after 20 warmup iterations:

| Shape | Changed items | Before (ms) | After (ms) |
| --- | --- | --- | --- |
| Wide | 0% | 7.713 | 6.500 |
| Wide | 1% | 8.797 | 7.591 |
| Wide | 10% | 14.665 | 13.187 |
| Nested | 0% | 8.368 | 6.975 |
| Nested | 1% | 9.126 | 7.796 |
| Nested | 10% | 15.896 | 14.537 |

These cases include undo middleware (recording suppressed during refresh), root
snapshot observation, references, and the inspector. Parsing is outside the
timer; automatic type checking is disabled. The measured reduction is 9–17%.

```sh
pnpm benchmark:build
BENCH_SIZES=10000 BENCH_FILTER=/refresh- BENCH_SAMPLES=100 BENCH_WARMUP=20 BENCH_JSON=/tmp/refresh.json pnpm --dir apps/benchmark bench:editor
```

A separate first-refresh experiment opened a fresh wide document for each sample,
copied its snapshot, forced GC, applied the unchanged copy without undo recording,
and forced GC again. Across 10 samples after three warmups, retained heap growth
fell from approximately 2.50 MB to 0.16 MB. This measures additional memory from
the first refresh, not total document memory; warmed refreshes have already paid
the baseline observation-allocation cost. Timings and heap measurements remain
sensitive to runtime and machine load.

## Grouped undo/redo

`bench:mutations` includes `undo-group-100`, `undo-group-1000`, and
`undo-group-10000`. Each records that many scalar edits into one group outside
the timer, then measures one undo/redo round trip with automatic type checking
disabled.

```sh
pnpm benchmark:build
BENCH_FILTER=undo-group BENCH_MIN_SAMPLES=10 BENCH_MAX_TIME=1 pnpm --dir apps/benchmark bench:mutations
```

Group flattening collects events into one array and reverses it once for undo,
removing temporary arrays and quadratic front-insertion work. End-to-end timing
remained largely unchanged in local 100–10,000-event measurements: patch replay
and history movement dominate. This change is retained as a code simplification
with better scaling, not as a claimed application-level speedup.

## Tree path construction

`bench:mutations` includes `tree-path-{root,parent,find}-d{1,8,32,128,512}`,
covering `getRootPath`, `getParentToChildPath`, and `findParentPath` on plain
object chains. Tree construction and an initial path-length assertion are outside
the timer. These are focused API measurements, not whole-editor speedups.

```sh
pnpm benchmark:build
BENCH_FILTER=tree-path BENCH_MIN_SAMPLES=20 BENCH_MAX_TIME=1 pnpm --dir apps/benchmark bench:mutations
```

The implementation appends segments during the child-to-root walk, then reverses
the completed arrays once. This replaces quadratic array copying with linear
work, without a cache or changes to observation and returned path ordering.

Paired production-bundle measurements on Node 24.18.0 / Apple M1 Max used ten
timed batches after two warmup batches, each with at least 2,000 calls. Median
`getRootPath` time per call was:

| Depth | Before (µs) | After (µs) |
| --- | --- | --- |
| 1 | 0.104 | 0.071 |
| 8 | 0.492 | 0.226 |
| 32 | 1.917 | 0.743 |
| 128 | 9.694 | 3.078 |
| 512 | 67.054 | 20.471 |

At depths 8–512, `getRootPath` took 54–69% less time; the other two APIs took
39–56% less time. A second optimized run reproduced the gains. Shallow controls
also improved, though absolute savings there are small. Runtime and machine load
affect these local measurements.

## Child-attachment tracking

`bench:mutations` includes `child-attachment-{100,1000,10000}`. Each subscribes
to an array with that many existing plain child nodes, then times an insertion
and removal in separate actions. Initial children are skipped; every timed
iteration verifies one attachment callback and one detachment callback.

```sh
pnpm benchmark:build
BENCH_FILTER=child-attachment BENCH_MIN_SAMPLES=20 BENCH_MAX_TIME=1 pnpm --dir apps/benchmark bench:mutations
```

`onChildAttachedTo` now copies its child set with `new Set(children)` instead
of a manual iterator loop. Both retain an independent copy and insertion order,
while the native constructor can copy the existing Set more efficiently.

Paired production-bundle measurements on Node 24.18.0 / Apple M1 Max used ten
timed batches of 100 insertion/removal pairs after two warmup batches:

| Existing children | Before (ms/pair) | After (ms/pair) |
| --- | --- | --- |
| 100 | 0.02195 | 0.01931 |
| 1,000 | 0.13134 | 0.06940 |
| 10,000 | 1.64861 | 0.91121 |

That is about 45–47% less time for the two larger collections. A second
optimized run reproduced the gains. These measurements cover attachment tracking
and the underlying mutations, not whole-application performance; results depend
on the JavaScript runtime and machine load.

## Ancestor lookup without a path

The `tree-path-find-node-d{1,8,32,128,512}` cases measure `findParent` on the
same plain chains as the path benchmarks. `findParent` now shares a traversal
helper with `findParentPath`, collecting path segments only for the latter.
It avoids allocating and reversing an array that callers never receive.

```sh
pnpm benchmark:build
BENCH_FILTER=tree-path-find BENCH_MIN_SAMPLES=20 BENCH_MAX_TIME=1 pnpm --dir apps/benchmark bench:mutations
```

On Node 24.18.0 / Apple M1 Max, paired production-bundle measurements using ten
timed batches after two warmups measured these median times per `findParent` call:

| Depth | Before (µs) | After (µs) |
| --- | --- | --- |
| 1 | 0.0465 | 0.0261 |
| 8 | 0.1775 | 0.1453 |
| 32 | 0.6757 | 0.5640 |
| 128 | 2.6893 | 2.6678 |
| 512 | 19.2896 | 16.9581 |

A repeat measured 15–16% less time at depths 8 and 32, versus 17–18% in the
first comparison. The immediate-parent case improved by 39–44%; deeper results
were less consistent. The `findParentPath` control stayed close to baseline.
These are focused lookup measurements, with small absolute savings per call.
