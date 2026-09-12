# Change Log

## Unreleased

- Return an idempotent disposer from `connectReduxDevTools` to stop logging and unsubscribe from monitor messages.
- Reject malformed JSON Pointer escapes instead of interpreting them as literal property names.
- Preserve undefined entries in sparse action arrays through JSON serialization.
- Keep action serializer traversal stable when a serializer registers or unregisters handlers during serialization.
- Report unsupported symbol action arguments as `MobxKeystoneError`, and close set iterators when element serialization fails.
- Implement codec-backed set union, intersection, difference, and symmetric difference without requiring native set methods; intersection avoids decoding the larger operand.
- Avoid copying codec-backed sets for subset, superset, and disjoint checks; use size checks and early exits while honoring codec-set membership.
- Enforce refinements around codec-backed values during model construction and writes, including rollback of invalid writes.
- Preserve current values when reusing writable custom codec views after they replace their stored data.
- Make codec-backed set operations match native set results and iteration order across supported MobX versions.
- Support JSON Patch `"-"` array appends and root-content replacement at an empty path; reject root removal and malformed or out-of-range array indexes instead of silently changing unrelated data.
- Accumulate callback failures in linear time rather than repeatedly copying all preceding failures.
- Return the stored runtime view from codec-backed map insertion helpers, so mutations through returned collections update the map.
- Track entry additions and removals when observing `ObjectMap.forEach` on MobX 4.
- Preserve large nested callback failure batches without argument-limit errors interrupting delivery.
- Restore falsy undo/redo attached state, and avoid leaking a recorder when the initial attached-state callback throws.
- Keep transaction rollback recording active after nested actions return.
- Discard rejected nested sandbox edits instead of replaying them on commit, and synchronize the sandbox with changes triggered during commit. Commits now cost time proportional to the changes being committed rather than to the size of the tree.
- Balance parent action-tracking resume/suspend hooks when a child completion hook throws.
- Honor child-hook disposal during attachment callbacks, including whether pending cleanup should run.
- Continue patch delivery to remaining listeners after a listener throws, then report the failures once delivery has finished. This also covers `patchRecorder` callbacks, so a failing recorder no longer silently stops the recorders registered on ancestor nodes, nor the deep-change listeners and the deferred patch listeners of the same mutation. Failures from all three are reported together.
- Added `MobxKeystoneAggregateError`, a `MobxKeystoneError` subclass with an `errors` array. Patch listeners, patch recorders, deep-change listeners and root store attachment hooks now share one failure rule: every callback runs, a lone failure is rethrown as is, and several failures are grouped in a `MobxKeystoneAggregateError` whose `errors` is a flat list, even across nested delivery.
- Preserve `__proto__` entries in `objectMap`, and return the stored value from its insertion helpers.
- Keep nested transforms' cache decisions independent, and retain cached transform values for `NaN`.
- Match native array argument handling for codec-backed `splice` and `at`, and support large codec-backed reversals and other whole-array mutations without argument-limit errors.
- Re-encode reused mutable codec inputs instead of returning stale encoded values, and preserve special property names in object, record, and map codecs.
- Pass the actual previous reference target to resolution-change callbacks on MobX 4/5.
- Support observable sets in JSON action-argument serialization.
- Restore sandbox state after a rejected commit so subsequent operations start from the actual original tree.
- Handle large undo patch batches without argument-limit errors, and avoid leaked undo recorders when attached-state saving fails.
- Invoke action-tracking completion hooks only once when a completion hook throws.
- Preserve explicitly supplied empty-string model IDs and reuse those models when snapshot reconciliation moves them.
- Restore the previous computed tree if its replacement cannot be attached.
- Ensure `objectActions.set` and `assign` update stored data and snapshots when used on observable models.
- Validate that `types.ref` values belong to the specified reference constructor.
- Preserve Redux middleware handler state across dispatches and invoke the full downstream chain on repeated `next` calls.
- Make Redux DevTools reset use the latest committed state, and avoid logging no-op actions after time travel.
- Accept scalar values alongside arrays in `arrayActions.concat` TypeScript arguments.
- Prevent repeated undo-group completion from duplicating history, and keep empty groups from discarding redo history.
- Reject invalid undo/redo history limits instead of allowing negative limits to hang history trimming.
- Reject asynchronous flow promises when completion middleware or an undo group's final attached-state callback throws, instead of leaving them pending.
- Run child-hook disposal callbacks in reverse attachment order, including explicit disposal. Continue remaining detachments and attachments when a callback throws, then report the first error.
- Support deeply nested frozen data without overflowing the call stack.
- Preserve literal `__proto__` properties when processing typed object and record snapshots.
- Preserve object identity between `asMap`/`asSet` and their backing collections, both when wrapping shallow observables and when writes convert values into observable objects or tree nodes.
- Object property setters now use `SameValueZero` equality, so re-setting a `NaN` property is a no-op. `0` and `-0` are treated as the same value throughout, matching `deepEquals`, literal type checks and JSON.
- ID-checked path resolution now rejects missing array properties instead of resolving them as `undefined`.
- `ArraySet.keys()` and `ArraySet.values()` iterators now visit values appended during iteration, matching the existing entries iterator.
- Keep root-store registration status reactive when attachment or disposal hooks throw, and continue remaining hooks before reporting the failures.
- Prevent subclass model initializers from running on base or sibling model instances.
- Exclude reverse-mapping names from numeric enums whose values include `NaN`.
- Make action-argument serializer disposers idempotent, so an old disposer cannot remove a later registration.
- Preserve invalid dates across JSON action-argument round trips.
- Prevent inherited property names and `__proto__` registrations from creating unintended model registry entries.
- Fixed `arrayActions.swap` reordering other items when both indexes are equal; non-integer indexes now return `false` without modifying the array.
- Empty paths in `Draft.commitByPath` and `Draft.resetByPath` now commit or reset the whole draft.
- Prevent the legacy `setYear` method from mutating immutable dates.
- `resolvePath` now distinguishes missing properties from properties whose value is `undefined`.
- Fixed stack overflows during children-first `walkTree` traversal of deeply nested trees.
- Fixed bigint literal type construction and `NaN` literal validation, including their type names in errors.
- Frozen-data validation now rejects cycles with a descriptive library error while continuing to allow shared descendants.
- Deduplicate `arraySet` initial values while preserving insertion order, so size and deletion behave consistently with a set.
- Fixed stack overflows in context value and provider lookups on deeply nested trees.
- Fixed `asSet.add` appending duplicate backing entries when the value is already present, which could leave stale entries after deletion or clearing.
- Fixed deletion of `NaN` in `ArraySet` and `asSet`, and updates/deletions of `NaN` keys in array-backed `asMap`, keeping backing arrays synchronized.
- Preserve literal `__proto__` entries in `mapToObject` conversions without changing the object prototype.
- Validate `applyPatches` against the completed batch, including nested/reversed patch lists, newly created models, and synchronous listener-triggered edits. Rejected batches roll back with compensating patches instead of leaving earlier patches applied. Literal property deletion and field-update semantics remain unchanged.
- Keep deep-change listener delivery stable when subscriptions change inside callbacks. Self-unsubscription no longer skips later listeners, listeners disposed while a change is being delivered no longer receive it, and duplicate callback registrations have independent, idempotent disposers.
- Continue deep-change delivery after a listener throws, so later global, subtree, and ancestor listeners observe the applied mutation, then report the failures once delivery completes.
- Preserve snapshot immutability when union types or custom output processors wrap shared child snapshots, including snapshots captured after earlier edits.
- Expose `DeepChange.isReentrant` for notifications that overlap listener-triggered mutations, allowing bindings to recover their final local state.
- Preserve chronological patch delivery and mutation-time paths when deep-change or patch listeners make reentrant edits. Patch recorders capture changes synchronously, preserving transaction rollback, recording scopes, and `withoutUndo` during listener-triggered edits.
- Fixed type-check error formatting for model data objects, allowing record-or-model unions to continue to a valid model alternative.
- Emit deep-change notifications after individual mutations pass automatic type checking and update their snapshots. Rejected mutations and their quiet rollbacks no longer reach deep-change listeners or CRDT bindings.
- Validate object key additions and removals without stale cached checks, including MobX 4 removal notifications, while preserving cached checks for unrelated subtrees.
- Fixed automatic type checking skipping a snapshot reconciliation target’s own model type. The target and its typed ancestors now validate the completed snapshot.
- Fixed stale snapshots after automatic type checking rejects snapshot reconciliation. Rollback now restores cached snapshots and emits compensating patches for already-published changes.
- Fixed argument-limit errors when large array splices update snapshots or emit forward/inverse patches; large snapshot splices now move the tail once without spreading inserted values into function arguments.
- Fixed snapshot reconciliation when replacing a nested model with a plain object, preserving the detached model instead of modifying its instance state.
- Improved `deepEquals` performance for primitive and shallow comparisons by avoiding redundant tree metadata and observable checks.
- Fixed stale parent snapshots when attaching a detached subtree with pending descendant changes, including model moves during snapshot reconciliation.

## 1.25.0

- Performance: reduced scalar mutation overhead by returning primitive values before entering internal MobX actions used for tree bookkeeping.
- Performance: applying the current snapshot by reference skips model-pool construction, avoiding a tree traversal on first use. Pending child changes are still flushed before treating the snapshot as unchanged.
- Performance: reduced automatic type-checking overhead for nested model mutations by traversing logical parents directly.
- Performance: reduce reconciliation work for non-null primitive model fields during snapshot updates, skipping unchanged fields and directly assigning changed scalar values.
- Performance: reduced construction work for models created from empty data with primitive defaults, reusing their initialization snapshot instead of rereading observable fields. Structured defaults retain the general initialization path.
- Performance: `findParent` no longer constructs a discarded path array while searching ancestors. `findParentPath` shares the same traversal and retains its existing path output.
- Performance: reduced child-set copying overhead in `onChildAttachedTo`, improving attachment tracking for large collections.
- Performance: path construction now scales linearly with tree depth, avoiding repeated array front insertions in `getRootPath`, `getParentToChildPath`, and `findParentPath`.
- Performance: reduced `applySnapshot` traversal overhead by using internal snapshots for reconciliation comparisons, avoiding unnecessary snapshot freezing and observation metadata. Fresh 10,000-item editor snapshot refreshes take about 9–17% less time in local benchmarks.
- Performance: reduced snapshot hydration work for models with primitive defaults or regenerated IDs by updating the existing initialization snapshot instead of rebuilding it from observable data. Initialization bookkeeping also allocates fewer temporary objects.
- Performance: reduced large-array insertion and removal overhead by batching parent-path reindexing for unchanged children. Moving the first model to the end of a 10k–50k-item editor list is about 30% faster with undo and snapshot observation enabled.

## 1.24.1

- Fixed a serious type-safety regression in the declarations published with versions 1.20.0 through 1.24.0, where `types.object(...)` data, snapshot, and stored-data types could collapse to `{ [x: string]: any }`. This allowed incorrect property values, unknown properties, and arbitrary property access to pass TypeScript checks. The missing declaration dependencies are now retained, restoring the exact object shape and optional-property inference, and package builds now fully type-check every generated declaration to prevent this from recurring.

## 1.24.0

- Added MobX 7 compatibility with standard-decorator coverage across TypeScript, Babel, and SWC.
- Performance: reduced fresh model creation overhead by skipping redundant primitive writes when initial data is already observable.

## 1.23.0

- Behavioral change: snapshot processors are now required to be pure and deterministic, and to round-trip canonical output without changing stored data. This applies to model `fromSnapshotProcessor` / `toSnapshotProcessor`, property-level `withSnapshotProcessor(...)`, typed-property processors, and `types.codec(...)` transforms. To make snapshot work faster, the library now treats processors as replaceable by their result: it may skip the input processor when the incoming snapshot already equals the model's current canonical output snapshot, may cache `toSnapshotProcessor` results, and may not compile a processor at all until it is first needed. A processor that relies on running on every invocation — logging, counters, ID generation, reads or writes of external mutable state — will therefore be called fewer times than before, or not at all. This is silent: there is no error, only the missing side effect. Review any processor that does more than convert its input before upgrading.
- Performance: large-tree work is substantially faster: 58% higher throughput hydrating 2,000 model items, 35% higher throughput reversing 10,000 models, and 3.7x faster deeply nested mutations observed from the root (depth 128).
- Performance: applying a semantically unchanged, independently copied 10,000-item snapshot is 6.6x faster; applying a shared typed snapshot with 1% of items changed is 6.1x faster. Snapshot processing is now lazy for identity-only typed properties and can skip unchanged canonical snapshots during `applySnapshot` (see the snapshot processor contract above).
- Performance: wide runtime type-checked model mutations are 37% faster. Type checking also preserves the correct error path when a typed container moves, and correctly invalidates `types.object(...)` checks when an omitted optional property is added under MobX 4.

## 1.22.0

- Performance: sped up large snapshot and array initialization by reducing per-item MobX writes during initial tree tweaking.
- Added a `logChildActions` option to `connectReduxDevTools` for suppressing nested action entries and logging the outermost tracked action instead.

## 1.21.0

- Fixed codec-backed `tProp(...)` defaults so runtime `Map`/`Set` values (including custom codec defaults) are encoded before being stored, avoiding initialization errors and keeping default-fallback error paths accurate.
- Security: hardened action replay and serialized/snapshot plain-object handling to reject prototype-chain paths, avoid `__proto__` prototype poisoning during object reconstruction, and refuse replay of non-action methods.
- `inDevMode` now treats missing `process.env.NODE_ENV` as non-dev mode instead of implicitly treating it as development. This avoids enabling dev-only behavior when bundlers do not inject `NODE_ENV`, but it is a behavioral change for environments that previously relied on an unset `NODE_ENV`.

## 1.20.0

- Added `types.codec(...)` plus built-in codecs/factories for `bigint`, dates, maps, and sets (`types.bigint`, `types.dateAsTimestamp`, `types.dateAsIsoString`, `types.mapFromObject(...)`, `types.mapFromArray(...)`, `types.setFromArray(...)`).
- Added `TypeToSnapshotIn<T>` / `TypeToSnapshotOut<T>` helper types and `CodecTypeInfo`.
- Fixed `$modelId` getter typing to return the proper `ModelIdPropertyType` instead of a loosely-typed value.
- Performance: optimized `rootRef` resolution and backref updates in large reference-heavy initialization flows by skipping `resolveId(...)` work for detached refs and avoiding no-op backref update actions.
- Added `types.skipCheck(type)` — a wrapper type that disables runtime validation while preserving snapshot processing, codec conversions, and transforms.
- Deprecated built-in transform helpers in favor of codec equivalents with `types.skipCheck(...)`: `timestampToDateTransform`, `isoStringToDateTransform`, `stringToBigIntTransform`, `objectToMapTransform`, `arrayToMapTransform`, `arrayToSetTransform`. Also soft-deprecated `.withTransform(...)` — prefer `tProp(types.codec(...))` or `tProp(types.skipCheck(...))` for new code.

## 1.19.0

- Added `idProp.withGenerator(...)` to define per-model ID generation for `idProp` fields, including inheritance-aware behavior in `ExtendedModel`.

## 1.18.0

- Added `defineModelMixin` and `composeMixins` helpers for type-safe class-model mixin composition without per-factory cast boilerplate.
- Fix: preserve intermediate model props when composing extended/decorated model classes in inheritance chains (for example chained mixins), so runtime-composed classes keep all props from previous composition steps.
- Fix: `composeMixins` now keeps mixin-added model prop typing markers for non-function fields, so `ModelData<>` and `ModelCreationData<>` reflect mixed-in props.

## 1.17.0

- Performance: model auto type-checking is now faster for updates in large or deeply nested models. Type checks now re-run only for changed properties while unchanged branches reuse cached results, reducing repeated validation work during frequent updates. This is an internal optimization and does not change the public API.

## 1.16.0

- Fixed a long-standing bug: model auto type-checking now enforces ancestor property refinements (for example refinements on `a.b`) when mutating nested child model data (for example `a.b.x`), while still avoiding unnecessary ancestor checks when no refinement is present on the path.
- Performance: reduced runtime type-check overhead by caching object prop checker resolution, avoiding success-path child path allocations in object/array/tuple/record checks, and narrowing `types.or` branch checks by base type.

## 1.15.0

- Added `registerModels(...)` to explicitly keep model/data-model class references at runtime (useful in snapshot-heavy apps where imports may be elided).
- Improved unknown model registry errors to include actionable guidance (`registerModels`, side-effect/runtime imports, and typed/runtime model references).
- Performance: model auto type-checking is now significantly faster by validating only changed branches and invalidating caches more selectively (including arrays, tuples, records, and wrapper types such as `or`/`refinement`). Before these changes setting a single type-checked property had a penalty of a 95% vs the non type-checked version. After changes this penalty is reduced to a 25% instead.

## 1.14.0

- `TypeCheckError` now supports a single object parameter and still accepts positional constructor arguments for backward compatibility.
- `TypeCheckError.throw()` now throws `TypeCheckErrorFailure` (which extends `MobxKeystoneError`), and union snapshot mismatches now throw `SnapshotTypeMismatchError` (also extending `MobxKeystoneError`) with structured metadata.
- Snapshot processing now throws a dedicated `SnapshotProcessingError` (extends `MobxKeystoneError`) across `fromSnapshot` / `applySnapshot` / reconciliation paths.
- `SnapshotProcessingError` messages now include enriched diagnostics text (full deep path, value preview, and model trail when available), making it much easier to pinpoint failing nested fields quickly.
- `SnapshotProcessingError`, `SnapshotTypeMismatchError`, and `TypeCheckError` now share one diagnostics message formatter and a consistent layout: `MSG - Path: ... - Value: ... - Model trail: ...`, so error output is predictable across snapshot and type-check flows.
- Improved snapshot/type error diagnostics end-to-end: path-aware messages across `fromSnapshot` / `applySnapshot` / union snapshot processing, plus structured error metadata (`path`, `expectedTypeName`, `actualValue`, `typeCheckedValue`, `modelTrail`) on thrown errors when available for easier tooling and debugging.
- Note: because diagnostics were improved, error message text changed in these paths (`TypeCheckError`, `SnapshotProcessingError`, `SnapshotTypeMismatchError`, and related snapshot/apply patches flows). If you assert exact error strings, update expectations.
- `applyPatches` reconciliation errors now also include accurate patch paths in diagnostics.

## 1.13.0

- Added array syntax as a `tProp` union shorthand, for example `tProp([String, Number])` as an alias for `tProp(types.or(String, Number))`.
- Docs: added a migration guide for moving from `mobx-state-tree` to `mobx-keystone`.
- `withSetter` now supports a value transform function (for example `withSetter(cloneTreeValue)`) for preprocessing setter values.
- `cloneTreeValue` now accepts clone options (same as `clone`), so callers can customize behavior (for example `generateNewIds: false`).

## 1.12.2

- Fix: preserve third-party decorator metadata when wrapping model actions, flows, computed getters, lifecycle hooks, and standalone actions/flows (#559).

## 1.12.1

- Fix: `toSnapshotProcessor` now correctly defers execution until the model instance is fully initialized, allowing access to model properties and computed values (#560).

## 1.12.0

- Adds `getSnapshotModelType`, `getSnapshotModelId` and other utilities.
- Adds support for Loro CRDT via the new `mobx-keystone-loro` package.

## 1.11.5

- Fix: Some retrocompatibility issues with MobX 4/5.

## 1.11.4

- Fix: redux devtools revert was not working correctly.

## 1.11.3

- Fix: observable data will now be turned into plain data when frozen, which also fixes an issue when undoing/redoing changes to frozen objects.

## 1.11.2

- Fix: in some cases, when reconciliating a model that was being moved to the end of an array it could complain that the node was duplicated.
- Wrapped `onChildAttachedTo` actions in MobX actions.
- Make `ObjectMap` and `ArraySet` use proper iterators.
- `asSet` and `asMap` are no longer actions.

## 1.11.1

- Fix for `onChildAttachedTo` firing for current children even when `fireForCurrentChildren` was set to false.

## 1.11.0

- Fixed some types so they are compatible with TypeScript 5.6.

## 1.10.2

- Fixed some types so set transformations are compatible with TypeScript 5.5 once more.

## 1.10.1

- Some more minor optimizations, for example creating models should be around 10% faster now.

## 1.10.0

- Some optimizations, for example reading values should be around 2x faster now.

## 1.9.0

- Adds support for `YjsTextModel` from `mobx-keystone-yjs`.

## 1.8.3

- Data model classes can now be passed as types directly, like model classes can.

## 1.8.2

- New! Y.js bindings for `mobx-keystone` are now available in the `mobx-keystone-yjs` package as well as a working example in the examples section of the online docs.
- Added missing `nanoid` dependency to the list of dependencies.

## 1.8.1

- Fix so `onGlobalPatches` only generates the patches for new models when they are generated via `fromSnapshot`.
- Fix so new `onGlobalPatches` paths won't include '$' in their paths.

## 1.8.0

- `onGlobalPatches` will now get called for new models whenever the initial snapshot values where overridden by defaults or missing IDs.

## 1.7.1

- Performance improvements when using the "new" non-experimental standard decorators: do not use class proxies.

## 1.7.0

- Added support for "new" non-experimental standard decorators. The old ones are still supported.

## 1.6.5

- Some small optimizations.

## 1.6.4

- Fixed an error about finding types when using TS in bundler mode.

## 1.6.3

- Fixed a bug where an object was sometimes being detached and then again retached when using applySnapshot.

## 1.6.2

- Fixed a bug where the `onAttachedToRootStore` disposer was not being called for models inside arrays.

## 1.6.1

- Fixed a bug where extra `attachToRootStore` calls and patches were being made when using `applySnapshot` to reconcile models with the same ID.
- Speed up a bit Typescript types.

## 1.6.0

- It is now possible to override default values when extending a model, but it is now on the user side to ensure that the base and extended types are compatible.

## 1.5.0

- Added `maxUndoLevels` and `maxRedoLevels` to `undoMiddleware` options to limit the number of undo/redo levels.

## 1.4.1

- Optimizations yielding around 10-15% less CPU time for some operations.

## 1.4.0

- Use a proxy to decorate model classes to reduce the inheritance level of models by one.
- Create object children cache only when there are actually children to save some memory in objects/arrays that don't have children of type object.
- Cache props/tProps to save some memory in model definitions.

## 1.3.0

- Big memory optimizations for model definitions with many properties (very little changes for model instances though). This change now makes Proxy support a requirement.
- Minor speed optimizations.

## 1.2.0

- TypeCheckError now includes a new `message` field, a new `typeCheckedValue` field and no longer requires a parameter for the `throw()` method.
- Type checking error messages will now include the actual value that failed validation in the error message.

## 1.1.1

- Fixed an issue related to computed trees.

## 1.1.0

- Added `idProp.typedAs<T>()` to be able to type an ID prop with a string template.

## 1.0.0

- Since the API has been quite stable for a while I think it is time for a v1.0.0 release. :) No other changes.

## 0.69.9

- Fix for `applySnapshot` throwing an exception when removing a property which was not declared in the model.

## 0.69.8

- Fix for `standaloneFlow` typing.

## 0.69.7

- Attempt to fix react native bundling issues.

## 0.69.6

- Fix for a possible infinite recursive call when using `types.tag`.

## 0.69.5

- Fix `applySnapshot` so it respects default initializers.
- Setting a prop that has a default value to `undefined` or `null` will set it to its default value (same as if it was done in `new` or `fromSnapshot`).

## 0.69.4

- Fixed an issue that prevent model actions/flows from being used when destructured.

## 0.69.3

- `ModelData` and `ModelCreationData` now take into account any possible transformations. If you want to use the old ones (without transformations) then use `ModelUntransformedData` and `ModelUntransformedCreationData`.

## 0.69.2

- Fixed an issue related to modelActions and modelFlows in derived classes giving an error on instantiation.

## 0.69.1

- Fixed an issue where value-types would always generate patches when `applySnapshot` was being used (even if the contents of the value-type did not really change).

## 0.69.0

- Added `types.tag` to be able to annotate types.

## 0.68.6

- Fixed `applySnapshot` generating no-op patches sometimes.

## 0.68.5

- Fixed `fromSnapshotProcessor` not accepting null or undefined when a `tProp` with a default value was used.

## 0.68.4

- Fixed react-native not picking up the right bundle.

## 0.68.3

- Fixed a bug related to sorting arrays producing patches that end up in a same node being temporarily twice in the tree.

## 0.68.2

- Reverted ESM splitting.

## 0.68.1

- Split the ESM version in several files to improve the tree-shakeability of the library.

## 0.68.0

- Removed side effects to improve the tree-shakeability of the library.

## 0.67.5

- Fixed a bug so `$modelType` should no longer be needed when it is defined with `tProp`.

## 0.67.4

- Fixed an issue introduced in 0.67.0 related to the use of tProp and getting stale snapshots.

## 0.67.3

- Fixed an issue related wrong validation of tProps of nullable/undefinable arrays.

## 0.67.2

- Small optimization to some of the walk tree methods.
- Fixed a typing issue where statics would not be picked up by ExtendedModel.

## 0.67.1

- Improved model creation time by around 25% when using mobx 6 for models without mobx decorators.

## 0.67.0

- Big speedup in certain cases (when many mutations are done between `getSnapshot` calls) by delaying the immutable object creation to the point when `getSnapshot` is called.
- Fixed typing issue related to generics with optional props.

## 0.66.1

- Fixed typing issue related to generics.

## 0.66.0

- Restored compatibility with mobx 4/5 and added CI tests to ensure it never gets broken again.
- Added `@computedTree` decorator for reactively deriving an alternative view of an original tree that is attached as a property to the original tree to support tree traversal functions, contexts, references, etc. (see "Computed Trees" section in the docs).

## 0.65.0

- Fixed a `Maximum call stack size exceeded` getting triggered when `onAttachedToRootStore` was defined and many nodes were added at once.
- Added property transform `stringToBigIntTransform`.
- Added action serialization for non-JSON primitive values `undefined`, `bigint` and special `number` values `NaN`/`+Infinity`/`-Infinity`.

## 0.64.1

- Fixed a typing issue related to models that use generics at multiple levels.

## 0.64.0

- [BREAKING CHANGE] `types.ref` now takes as an argument the reference constructor it needs to check for.
- When `tProp` is used instead of `prop` then `$modelType` won't be needed in input model snapshot for that particular property. As a side effect, `$modelType` is now marked as optional in types. Note that for this to work for a root model instead of a sub-property you will need to use the new `fromSnapshot` overload that takes a type as first argument. For untyped compatibility reasons, `getSnapshot` will still return `$modelType` even for typed models.
- Added `withSnapshotProcessor` to class model properties.
- Model classes can now be directly used as types instead of having to wrap them inside `types.model(...)` (except in recursive / self-recursive cases).
- Simplified some typings to make them faster.

## 0.63.2

- Fixed a typing issue that would type `$modelId` as `string | undefined`. Now it will be typed as `string` when there is an `idProp` and `never` when there is not.

## 0.63.1

- Added `FromSnapshotDefaultType<typeof props>` and `ToSnapshotDefaultType<typeof props>` so the default type does not need to be repeated when using `fromSnapshotProcessor` / `toSnapshotProcessor`.

## 0.63.0

- [BREAKING CHANGE] The model override `fromSnapshot` has been removed in favor of `fromSnapshotProcessor` / `toSnapshotProcessor` options of `Model` / `ExtendedModel`. These allow you to set up pre/post snapshot processors for models.

## 0.62.0

- [BREAKING CHANGE] `$modelId` is no longer a requirement and will be no longer automatically added to models. If you want your models to keep using the old behavior (having a `$modelId` property) then add a `[modelIdKey]: idProp` or a `$modelId: idProp` property to them. Note that `$modelId` can still be used in instances to get/set the current ID property, just that it might be undefined (get) / throw (set) when there is none.

## 0.61.3

- Fix to avoid calling `onAttachedToRootStore` more more often than it should.

## 0.61.2

- Fixed a typing issue related to extending a class model with an `idProp`.

## 0.61.1

- Fixed `types.model` sometimes picking any as the model type.
- Fixed type checking sometimes giving false errors upon reconciliation.

## 0.61.0

- Added `withTransform()`, a new way to do property transforms, as well as the pre-made transforms `timestampToDateTransform`, `isoStringToDateTransform`, `objectToMapTransform`, `arrayToMapTransform` and `arrayToSetTransform`. See the docs `Maps, Sets, Dates` section for more info.
- Data models can now use default property initializers.
- Added `apply` and `applyComputed` to contexts so that they can be used to share information with models on creation time (kind of like `envs` in Mobx-state-tree). See the context docs for more details.
- Fixed an issue with `asMap` where the map would not get updated when the backing array/object changed.
- Fixed an issue with `asSet` where the set would not get updated when the backing array changed.

## 0.60.7

- `idProp` now correctly handles `withSetter`.

## 0.60.3

- Switched bundler from microbundle to vite.
- Deprecated prop modifier variant `withSetter("assign")`, use `withSetter()` instead.
- Changed to nanoid from uuid for model id generation.

## 0.60.2

- Added `swap` to array actions.

## 0.60.1

- Added `package.json` to the exports list to avoid issues with metro bundler from react native.

## 0.60.0

- Added `createGroup` to `undoMiddleware`, which allows to group several actions perform in separate code blocks.
- Added an overload to `toTreeNode` that accepts a type checker as first argument.
- Added standalone actions. See the relevant section of the docs for more info.

## 0.59.0

- Added `attachedState` to the `undoMiddleware`. Useful to save/restore state related to actions but that shouldn't be part of the undo/redo event queue (e.g. selection, text editor cursor position, etc.).
- Added `findChildren` to be able to find all children of a subtree root node for which a predicate matches.
- Improved support for generics when using references.

## 0.58.2

- Generic types are now inferable from the constructor parameters

## 0.58.1

- Fixed an issue where `idProp` on the base was not being picked up by `ExtendedModel`.

## 0.58.0

- Added a simpler pattern for generic models when using `prop`.
- Added `resolveId` to be able to resolve a model given its ID.

## 0.57.1

- Fixed an issue when importing the package with expo.

## 0.57.0

- Made `getRefsResolvingTo` able to get updated results when called inside an action (as long as the reference being back-traced and the target are children of the same root).

## 0.56.2

- Fixed an issue with typings not working properly for model properties (probably introduced in v0.55.0).

## 0.56.1

- Fixed webpack import section in `package.json`.
- Made `onInit`, `onAttachedToRootStore` and `onLazyInit` protected.

## 0.56.0

- `types.model` and `types.dataModelData` no longer require the type as a generic argument in TypeScript for non-recursive cases.

## 0.55.1

- Changed build tooling.

## 0.55.0

- [BREAKING CHANGE] `setterAction: true` prop option is now `prop().withSetter()`
- [BREAKING CHANGE] `setterAction: "assign"` prop option is now `prop().withSetter("assign")`
- [BREAKING CHANGE] Functional models have now been removed in favor of Data models, which serve a similar function while having a syntax closer to standard class models. See the relevant new section in the docs for more info.
- [BREAKING CHANGE] Property transforms have been removed (including 'prop_mapArray', 'prop_setArray', ...). Consider switching to 'objectMap', 'asMap', etc. or a getter/setter with a transform inside pattern.
- [BREAKING CHANGE] Property transform decorators have been removed.
- [BREAKING CHANGE - types] Some type helpers have been renamed: `ModelPropsData` / `ModelInstanceData` -> `ModelData`, `ModelPropsCreationData` / `ModelInstanceCreationData` -> `ModelCreationData`.
- `onSnapshot` now also takes a function that returns a node.
- Added `valueType` option to `Model`/`ExtendedModel` so that class models of that kind automatically get auto-cloned when assigned to a property/array/etc., useful for example for primitive data structures such as points, colors, etc. Check the relevant section of the docs for more info

## 0.54.0

- Added `withGroupFlow` to `UndoManager` so that several async actions can be undone/redone as a single step.

## 0.53.0

- [BREAKING CHANGE] Now requires TypeScript 4.2.0.
- [BREAKING CHANGE] Class model `setterAction: true` prop option will now generate a setter like `setX` automatically instead of making the property assignable. To get the old behaviour use `setterAction: "assign"` instead.
- [BREAKING CHANGE] Functional model `setterActions` now just take the field names rather than an object with the setter mapping.
- Fixed an issue when using `ExtendedModel` with abstract classes in TypeScript 4.2.0.
- Fixed committing non-idempotent sandbox changes to the original subtree.

## 0.52.0

- Added `withGroup` to `UndoManager` so that several sync actions can be undone/redone as a single step.

## 0.51.1

- Fix for broken library build.

## 0.51.0

- Added `withoutUndo` and `isUndoRecordingDisabled` to `UndoManager`. Consider using those instead of the global `withoutUndo` if more precision over which `UndoManager` to skip recording to is needed.

## 0.50.0

- It is now possible to use a custom property as model id instead of `$modelId` by assigning to a property the new `idProp` value. In any case, model instances can still use `model.$modelId` to read/write this custom property if desired.

## 0.49.0

- [BREAKING CHANGE] The sandbox manager's `withSandbox` method now requires an array of nodes from the original tree and the corresponding sandbox nodes are now positional arguments of the callback function.
- Fix for a possible issue when using `applySnapshot` with hot reloading.

## 0.48.5

- Fixed incompatibility with MobX >= 6.1 (in order to fix it `$modelId` is now an enumerable property though).
- Fixed the sandbox to group commit patches so that the undo manager will undo the commit in a single step.
- Added `assign` to `fnObject`.

## 0.48.4

- Fixed TypeError path for refinement types.
- Fix for the undo manager so it will correctly group reference invalidations inside the action that caused it.
- `ExtendedModel` will now throw when the `baseModel` argument is not a model class.

## 0.48.3

- Remove `require` usage from esm modules to fix snowpack compatibility.

## 0.48.2

- Added `showDuplicateModelNameWarnings` to the global config.

## 0.48.1

- Fixed compatibility with MobX v5 and v4 when using ESM build.

## 0.48.0

- Made it compatible with MobX v6 while keeping it compatible with v5 and v4 still.

## 0.47.1

- Make the typing of some functions not rely on mobx internal typings.

## 0.47.0

- Added `onPatches` callback option to the `patchRecorder`.
- The `events` list in the `patchRecorder` is now an observable array.
- `types.enum` no longer requires the generic type in typescript, the enum object as parameter is enough.

## 0.46.0

- [BREAKING CHANGE] Runtime type-checking of objects will no longer complain about excess properties, they will just be ignored.

## 0.45.5

- Fixed an issue related to typing changes of the generated types optimization for extended models.

## 0.45.4

- Fix: The type of data inside frozen is no longer forced to be `DeepReadonly`. This fixes a possible issue where the type might no longer be assignable with itself.

## 0.45.3

- Fix: `onAttachedToRootStore` will still be invoked after all model actions are finished (as it was before), but now before other user reactions are triggered.

## 0.45.2

- Fix: `allowUndefinedArrayElements` now also applies to frozen data.
- Optimized a bit the generated typings for extended models.

## 0.45.1

- Fixed a bug when calling an undo-able model action from a non undo-able parent model.

## 0.45.0

- Added `allowUndefinedArrayElements` global config option to allow arrays to take `undefined` elements.

## 0.44.0

- Added `assertIsTreeNode`, which asserts if an object is a tree node or throws otherwise.

## 0.43.1

- Fixed an issue with automatic setter actions not working when the model included computed properties.

## 0.43.0

- [BREAKING CHANGES]
  - `applyCall` has been renamed to `applyMethodCall` - consider using `fnObject.call` though.
  - `arrayAsMap`, `ArrayAsMap` were removed (see `asMap` for a replacement).
  - `arrayAsSet`, `ArrayAsSet` were removed (see `asSet` for a replacement).
  - `objectAsMap`, `ObjectAsMap` were removed (see `asMap` for a replacement).
- Added `asMap` and `asSet`, which are similar to the old `arrayAsMap`, etc. except that they take the data object directly.
- Added `fnModel` as a functional alternative to models that do not require `$modelId` or `$modelType` (see the relevant section on the docs for more info).
- Added `tag` to be able to tag objects with extra data (useful for functional models for example).
- Added `fnObject` and `fnArray` to be able to directly manipulate objects/arrays without the need of predefined model actions.

## 0.42.1

- Fixed issue with updated uuid dependency.

## 0.42.0

- Added the model property option `setterAction` so that it automatically implenents model prop setters wrapped in actions.
- Added `applySet`, `applyDelete`, `applyCall` to be able manipulate data without the need to use `modelAction`.

## 0.41.0

- When using date transforms, mutation made by methods (`setTime`, etc.) are reflected in the backed property (string / timestamp), so it is no longer required to treat dates as immutable objects.
- Performance improvements for implicit property transform collections.

## 0.40.0

- [BREAKING CHANGE - types] Some type helpers have been renamed: `ModelData` -> `ModelPropsData` / `ModelInstanceData`, `ModelCreationData` -> `ModelPropsCreationData` / `ModelInstanceCreationData`.
- New feature: "Implicit property transforms", which are sometimes preferred over the old decorator based property transforms, collection wrappers (`arrayAsSet`, `arrayAsMap`, `objectAsMap`) and collection models (`ArraySet`, `ObjectMap`). Check the "Maps, Sets, Dates" section in the docs for more info.
- Added `types.tuple`.
- Property transforms decorators can now also be used standalone.

## 0.39.0

- Added `decoratedModel` so the library can be used without decorators.

## 0.38.0

- Fixes for `undoMiddleware`, where it wouldn't properly record changes outside a subaction after a subaction is performed.
- `applyPatches` now supports arrays of arrays of patches.
- Improved reconciliation - now `applyPatches` and `applySnapshot` are more likely to reuse instantiated model objects whenever possible rather than recreating them anew (as long as their model types and ids match).
- Added `isSandboxedNode` and `getNodeSandboxManager` to be able to tell when a node is sandboxed / which is its sandbox manager (if any).

## 0.37.0

- Deprecated `abstractModelClass`, which should not be needed anymore.
- Added `modelClass` to better support base models with generics.
- A few type optimizations.
- Fixed undo middleware regression (not properly undoing) that happened in v0.33.0.

## 0.36.1

- Made `applySnapshot` not check by model instance in reconciliation for better compatibility with hot-reloading.
- Fixed `ObjectMap.forEach` and `ArraySet.forEach` typings.

## 0.36.0

- Added new way / guide to use the factory pattern when `declaration` option is set to `true` in `tsconfig.json`.

## 0.35.0

- [BREAKING CHANGE] `onAttachedToRootStore` and its disposer will be called after all actions are finished.
- Improvements to ensure `onAttachedToRootStore` and its disposers are called in a more reliable manner.
- `getRootPath`, `getRoot`, `getRootStore` are now internally computed, so they should be faster when being observed.
- Warnings about duplicate model names will now only show once per model.

## 0.34.0

- Optimized the patches generated for array operations.
- Added support for obtaining multiple sandbox nodes at the same time.
- Added `$modelType` as static property to model classes, as well as a better `toString()` to model classes and instances for logging purposes.
- Static properties now will be preserved in classes that use the model decorator.

## 0.33.0

- Fixed an issue with wrong patch order being generated for actions triggered inside `onAttachedToRootStore`.
- Added support to `applyPatches` for applying patches in reverse order.
- Fixed applying inverse patches in reverse order.

## 0.32.0

- Added `sandbox` to create a sandbox copy of the state for testing "what-if" scenarios; changes can be either committed to the original state or rejected (see Sandboxes section in the docs).

## 0.31.0

- Added `deepEquals` to deeply check for equality standard values, observable values, and tree nodes.
- Added `draft` to create drafts of parts of the state that can be later committed to it (see Drafts section on the docs).

## 0.30.1

- Fixed an issue with the readonly middleware where sometimes it was possible to write to a protected node when the write was being done from an unprotected parent node action.

## 0.30.0

- It is now possible to use `ExtendedModel` over classes that use the `@model` decorator.

## 0.29.0

- Made `isRootStore` reactive.

## 0.28.4

- `onAttachedToRootStore` and its disposer will be called right after a change is made rather than after a whole action is finished (restores behaviour of version &lt;= 0.28.1).

## 0.28.3

- Improve a bit the atomicity of `modelAction` / `runUnprotected`.

## 0.28.2

- Fix: modifying a node inside `onAttachedToRootStore` or its returned disposer no longer results in broken snapshots.

## 0.28.1

- Updated min TypeScript version to 3.7.

## 0.28.0

- [BREAKING CHANGE] If you want to use `ExtendedModel` over an abstract class now it must be done like `ExtendedModel(abstractModelClass(SomeAbstractClass), { ... })`.

## 0.27.0

- Added `getTypeInfo(type: AnyType): TypeInfo` to get runtime reflection info about types.

## 0.26.7

- Simplified types.or typing.

## 0.26.6

- Switched an error to be a warning instead when using hot reloading.

## 0.26.5

- Added a ponyfill fallback for btoa for React Native.

## 0.26.4

- Fix compatibility with babel decorators.

## 0.26.3

- Fixed type generation.

## 0.26.1

- Optimized types a bit.

## 0.26.0

- Made it impossible in TypeScript to give a default value for an object type without using a default value generator function to avoid possible mistakes.

## 0.25.3

- Fixed `applySerializedActionAndTrackNewModelIds` so it won't track `$modelId` changes for plain objects.
- Added `Path` and `PathElement` types.

## 0.25.2

- Fixed an issue with back-references and `onResolvedValueChange` not working when references were being restored from a snapshot.

## 0.25.1

- Small optimization for `applySerializedActionAndTrackNewModelIds` so it doesn't traverse frozen values.

## 0.25.0

- Added `applySerializedActionAndTrackNewModelIds` and `applySerializedActionAndSyncNewModelIds`. Prefer those over `deserializeActionCall` plus `applyAction` when applying serialized (over the wire) actions in order to avoid `$modelId` desynchronization.
- Added a default implementation of `getRefId()` which returns `$modelId`.

## 0.24.1

- Fixed wrong patches being generated for array splices sometimes.

## 0.24.0

- [BREAKING CHANGE] Allow to pass `$modelId` to model creation data to override it rather than using a special symbol.
- [BREAKING CHANGE] Removed `overrideRootModelId` to `fromSnapshot` and `clone`, but made `$modelId` in models editable instead.

## 0.23.2

- Added `overrideRootModelId` to `fromSnapshot` and `clone`.

## 0.23.1

- Added options parameter to `clone`.

## 0.23.0

- [BREAKING CHANGE] Added a `$modelId` extra property to models and their snapshots in order to be able to properly validate targets of serialized actions in scenarions with concurrent clients. Also allows the automatic optimization of the serialized version of models in action parameters by substituting them to just their paths + path of ids whenever possible.
- [BREAKING CHANGE] Default values for properties will now also apply when the initial data is `null`.
- `serializeActionCall`, `serializeActionCallArgument`, `deserializeActionCall` and `deserializeActionCallArgument` now can take a second parameter with the root node of the model where actions are going to be performed to optimize the serialization of arguments that are already in the store.
- Added `registerActionCallArgumentSerializer` for serialization of custom action argument types.
- `ActionContext` now includes `targetPathIds`.
- Added `pathObjects` to `getRootPath`.
- Improved a bit the typing for `fromSnapshot` model methods.
- Added property transforms via `propTransform`.
- Improved action argument serialization so it supports dates, maps, sets, arrays of models, etc.
- `arrayAsMap` now supports arbitrary key types.

## 0.22.0

- Added `tProp` syntactic sugar for optional primitives with a default value.
- Added `String`, `Number`, `Boolean`, `null`, `undefined` as aliases for primitive types.
- Added `findParentPath`.

## 0.21.0

- [BREAKING CHANGE] Paths to model properties will no longer report interim data objects (`$`). This means that properties are now direct children of model objects, which should be cleaner and more understandable.

## 0.20.2

- Fixed a possible memory leak with refs.

## 0.20.1

- Optimizations for `rootRef` resolution when the node cannot be resolved.

## 0.20.0

- Added `isRefOfType(ref, refType)` to check if a ref is of a given ref type.
- Added `getRefsResolvingTo(node, refType?)` to be able to get back references that are currently pointing to a node.

## 0.19.0

- Added `setDefaultComputed` and `getProviderNode` to contexts.
- [BREAKING CHANGE] `getChildrenObjects` will now never report interim data objects (`$`).
- Optimizations to `getChildrenObjects` and `onChildAttachedTo`.
- Added `rootRef`s.

## 0.18.0

- Added contexts to share information between parents and children and to make isolated unit testing easier.
- Models can now optionally offer a `getRefId()` method that can be automatically used by custom references to get their ids, thus making `getId` for custom references optional now.

## 0.17.4

- Fix path for ESM module.

## 0.17.3

- Added UMD modules and specify proper module for react-native, add tslib to dependencies.

## 0.17.2

- Fix issue with babel transpilation that would end up in some runtime errors.

## 0.17.1

- Fixed `onChildAttachedTo` disposer typing.

## 0.17.0

- Better support for array / object spreading, reassign to filter/map, etc. Objects and arrays will be automatically unconverted from tree nodes when detached.

## 0.16.0

- [BREAKING CHANGE] Again changes to flows so typings are better. Check the updated flow section of the documentation to see how to work with them now (should be much easier).

## 0.15.0

- [BREAKING CHANGE] Using flows in TypeScript should result in improved typings, but it requires TypeScript >= 3.6.2. Check the updated flow section of the documentation to see how to work with them now.

## 0.14.2

- Fixed `getChildrenObjects` and `onChildAttachedTo` so they don't report the model data objects (`$`). Set the option `includeModelDataObjects` to true to get the old behaviour back in `getChildrenObjects`.

## 0.14.1

- Fixed an issue with a workaround for abstract classes setting values on the constructor when using babel.

## 0.14.0

- Added `getParentToChildPath`, `getChildrenObjects` and `onChildAttachedTo`, and some performance improvements.

## 0.13.1

- Fixed an issue with ExtendedModel when user library was compiled using ES6 classes.

## 0.13.0

- Improved support for abstract base models.

## 0.12.4

- Renamed error class to MobxKeystoneError from MobxDataModelError.

## 0.12.3

- Updated dep with proper fixed version.

## 0.12.2

- Revert dep update that broke some types.

## 0.12.1

- Slight performance improvements. Basic benchmarks.

## 0.12.0

- Added `ExtendedModel` and a doc section about subclassing.

## 0.11.4

- Slight performance bump by moving decorators to the prototype.

## 0.11.0

- Fixed compatibility with mobx4.

## 0.10.0

- Added a second parameter to `getParent` to skip model interim data objects.
- Added `isModelDataObject` function.

## 0.9.14

- First public release.
