# Change Log

## Unreleased

- Remove stale native copies of locally written models during conflicting array reconciliation, preventing duplicate model IDs after positional edits or insertion/reordering spans.
- Restore locally edited primitive array entries after pending native deletions without creating sparse arrays or failing synchronization.
- With the updated core, keep synchronizing when an earlier model listener unsubscribes itself during change delivery.
- With the updated core, synchronize applied edits even when an earlier global or subtree deep-change listener throws.
- Preserve native model ordering when reconciliation combines model field edits with positional edits to non-model array entries.
- Preserve surviving native model containers and nested text when runtime snapshot reconciliation inserts or removes items without reordering the survivors. Avoid an extra native read for primitive arrays.
- Restore locally edited models removed by pending native deletions without overwriting surviving models or creating sparse arrays. Restored values are placed relative to surviving neighbors, while unrelated native replacements remain intact.
- Apply local model field edits at the model's pending native position, preserving native reordering and unrelated insertions/deletions instead of duplicating models at stale array indices.
- Detect conflicting pending native model identities along locally edited paths, including ordinary edits and Yjs transaction hooks, and reconcile those conflicts as whole model values. Unchanged identities keep incremental outgoing updates.
- Resolve conflicting model types and IDs atomically during startup and reentrant reconciliation, preventing fields from different model identities from producing invalid snapshots. Unchanged source values still preserve concurrent replacements.
- Reconcile local edits made by deep-change listeners even when child and ancestor notifications overlap. Unrelated pending native fields and array values are preserved, including fields of reordered models; ordinary changes remain incremental.
- Prevented startup model replacements from inheriting initialization edits belonging to the previous model ID or type, including transitions between models and plain objects. Publishing unchanged inferred metadata still preserves initialization edits.
- With the updated core, rejected individual local mutations no longer write CRDT operations or compete with concurrent native edits.
- Preserved native startup edits that overlap a value replaced with a frozen value during model initialization. The conflicting native value now replaces the initialized frozen value atomically.
- Preserved initialization edits to existing siblings regardless of incoming event order, including array appends applied exactly once. Initialization confined to a new model now writes back only the affected subtree.
- Rejected undefined and sparse array entries with `MobxKeystoneYjsError` before writes, and converted outgoing replacement values before deleting existing array items.
- Avoided unnecessary empty-array reads and source-key set allocation during JSON merges.
- Avoided allocating throwaway reactive atoms while resolving Yjs paths outside a MobX derivation, such as when writing local changes back to Yjs.
- Fixed recovery after a native transaction fails model validation or reconciliation. Subsequent events reconcile the current native snapshot until successful, then resume incremental updates.
- Preserved native Yjs edits made during model `onInit` before binding listeners exist. Startup now reconciles those changes without discarding unrelated defaults or model initialization edits, and releases the temporary context if this reconciliation fails.
- Fixed native edits from `beforeTransaction` hooks being ignored when they share the binding’s transaction origin. Changes in unrelated roots retain the ordinary incremental path.
- Fixed native edits triggered by binding-context activation being missed or overwritten during startup. Synchronization hooks and initial writeback now finish before publishing the bound context, including inside an open Yjs transaction.
- Fixed native transactions spanning multiple containers failing ancestor refinements between events. With automatic type checking enabled, these updates reconcile their nearest shared ancestor before validation.
- Fixed multi-key native map updates failing object refinements between assignments. Typed targets reconcile the affected map snapshot before validation; repeated values do not count as changes.
- Applied large contiguous native array replacements in one mutation, avoiding intermediate refinement failures and redundant change notifications from insertion batches.
- Fixed separated native array edits failing whole-array refinements on intermediate splices. Arrays under typed models combine the changed range into one splice, preserving retained nodes and avoiding whole-array reconciliation; arrays without typed model ancestors or with automatic type checking explicitly disabled retain separate incremental splices.
- Skipped snapshot construction and processing for native model map events that only repeat existing values.
- Fixed native model map updates bypassing `fromSnapshotProcessor`; affected models now reconcile their snapshots and write normalized values back to Yjs.
- Fixed incoming additions and updates to transformed model properties by applying stored values directly, avoiding an incorrect second conversion through the property setter.
- Fixed incoming map additions when MobX proxies are disabled: new plain-object keys now enter snapshots and remain synchronized on subsequent edits.
- Ignored empty incoming array, map, and text changes when choosing reconciliation scope, keeping unrelated structural changes within their affected subtree. Bindings created or locally edited during the transaction still reconcile to its final state.
- Avoided invalidating reactive text paths for native array transactions with an empty net delta, such as inserting and removing a temporary item in the same transaction.
- Canceled captured outgoing edits and default writeback when a Yjs `beforeTransaction` listener disposes the binding, preventing writes after disposal.
- Rejected merge mode on detached Yjs maps and arrays before mutation, preventing incorrect results from unsupported reads of detached contents. Add mode remains supported for detached containers.
- Coalesced consecutive pending edits when a full text-history replacement supersedes the previous edit to the same text, avoiding intermediate replay and preserving relative positions for reverted edits.
- Preserved Yjs relative positions and avoided document updates when local text-history replacement produces unchanged content and formatting. Changed histories are replayed once before applying their resulting delta.
- Fixed merge-mode writes replacing an existing `Y.Text` when its content changed, which orphaned the container and left observers, `YjsTextModel.yjsText`, and any other reference pointing at empty detached text. Changed text is now edited in place in both maps and arrays.
- Skipped incremental assignments for native map updates that repeat the same value, avoiding frozen-wrapper allocation, snapshot invalidation, and redundant MobX notifications.
- Fixed snapshot comparisons during binding initialization and reconciliation to accept JSON keys such as `valueOf` and `toString`, and detect initialization changes to signed zero.
- Fixed merge comparisons for frozen JSON and text attributes: object method names are treated as data keys, and signed zero is preserved recursively. Unchanged values still retain their references.
- Avoided full-tree writeback when incoming initialization hooks create or modify helper models outside the bound tree.
- Batched adjacent array-merge replacements, reducing Yjs searches and item splitting while preserving intervening container identities and unchanged values.
- Deferred text reactions until Yjs transaction cleanup completes, preventing reaction edits from being lost in another binding’s saved text history. Pending notifications are shared per document.
- Batched reactive notifications for all text changes in a Yjs transaction, preventing intermediate multi-text states and redundant reaction runs.
- Delayed reactive text notifications until incoming deltas are synchronized, preventing local edits from text reactions from corrupting the saved delta history.
- Avoided quadratic indexed reads when merging arrays of shared Yjs containers by collecting existing values in one traversal.
- Avoided full snapshot reconciliation when native edits repeat an unchanged model type discriminator, including transactions that also update ordinary properties.
- Fixed text loss during Yjs redo of a combined text edit and model move by correcting pending snapshot propagation in the core attachment path.
- Reconciled native changes to nested model IDs through their parents, preserving model identity during ID swaps and replacing instances for new IDs. Custom ID properties are supported, and unchanged IDs avoid parent reconciliation.
- Synchronized missing root and nested model metadata during initial binding even when no defaults or initialization edits occur. Initial synchronization now compares the completed snapshot instead of relying on initialization events.
- Stopped disposal-triggered reactions from writing back to Yjs and ignored queued Yjs callbacks that start after the binding has been disposed.
- Automatically disposed bindings when their bound Yjs subtree is deleted, releasing document subscriptions and binding context while preserving the local model.
- Combined adjacent native array insertions and deletions into replacement splices, avoiding invalid intermediate lengths for fixed-length refinements and reducing MobX notifications.
- Avoided replaying delta history when reading live empty text, and batched history replay for detached text reads and text merge comparisons into one transaction.
- Fixed numeric merge comparisons to preserve signed zero and avoid redundant updates for unchanged `NaN` values.
- Removed per-value conversion actions when applying incoming Yjs events, including bulk array insertions and structural reconciliation.
- Cleaned up binding subscriptions and context when initial synchronization throws.
- Avoided redundant model-path traversal when detecting outgoing text changes for ordinary object and array edits.
- Fixed default restoration when a model's array index changes in the same Yjs transaction.
- Reduced reactive text-path invalidation to changed map keys, and released unused key dependencies instead of retaining them for the lifetime of a map.
- Removed per-value MobX action overhead from recursive Yjs-to-JSON conversion.
- Stopped appending empty content deltas for Y.Text metadata-only changes.
- Batched JSON array/map helper writes into a single Yjs transaction, avoiding intermediate observer updates and per-item transaction overhead.
- Reduced structural synchronization work by constructing snapshots from event deltas and retaining unchanged snapshot branches. Primitive array deletions now use direct splices instead of per-element reconciliation.
- Fixed argument-limit failures when converting or synchronizing large arrays by bounding insertion batches.
- Fixed duplicated initial array/text content when binding inside an open Yjs transaction, and synchronization between multiple bindings with queued edits on the same document.
- Fixed remote deletion or nullish assignment of defaulted model properties, including synchronization of restored defaults back to Yjs.
- Fixed replacement of nested model instances when their Yjs model type discriminator changes.
- Fixed identity preservation for map swaps, moves between collections, and identified descendants of replaced containers by using the core snapshot reconciler for structural Yjs events.
- Fixed missing binding context in remote `onInit` hooks and synchronization of nested defaults by merging their final initialized state.
- Fixed queued model edits being duplicated, lost, or applied at stale indices when starting native Yjs transactions inside model actions.
- Fixed loss of the `__proto__` key when converting Yjs maps to snapshots.
- Fixed text synchronization when replacing delta lists or inserting and editing text in one action. Appended deltas now preserve existing Yjs text positions.
- Fixed the binding context's `isApplyingYjsChangesToMobxKeystone` flag and made disposal clear the binding context and stop text synchronization.
- Fixed model reconciliation for array replacements and updated reused models from incoming snapshots.
- Fixed JSON merges after direct Yjs edits or mutations to reused input objects. Special text/frozen snapshots now use their correct representation, and unchanged text retains its Y.Text instance.
- Reject binding objects that are not attached to the supplied Y.Doc.

## 1.7.0

- Declared compatibility with MobX 7.
- Updated the `mobx-keystone` peer requirement to `^1.24.0` to use the public MobX compatibility decorators.

## 1.6.0

- Refactored internal synchronization to use deep change observation instead of JSON patches. This provides proper array splice detection, avoiding the previous behavior where array operations were converted to individual element patches. The result is more efficient array synchronization and better alignment with how Y.js handles array modifications.
- Fixed a synchronization issue where values added to a collection and then mutated within the same action could cause desync. Snapshots are now captured at change time rather than at action completion time.

## 1.5.5

- Fixed an issue where data was not readable from detached models/arrays/records (e.g. after being detached from a bound tree).
- Fixed `YjsTextModel.text` throwing when accessed in a detached state.
- Improved handling of "dead" Yjs objects (deleted or document destroyed) to avoid unnecessary sync attempts and ensure proper disposal.
- `applyJsonArrayToYArray` / `applyJsonObjectToYMap` are no longer wrapped in mobx actions in case they want to track the original values.

## 1.5.4

- Fixed some more types.

## 1.5.3

- Fixed some types.

## 1.5.2

- Just renamed some internal types.

## 1.5.1

- Fixed a wrong import.

## 1.5.0

- Added undefined to accepted primitive "JSON" types.

## 1.4.0

- Added `YjsTextModel` as a way to use `Y.Text` as if it were a node.

## 1.3.1

- Added `boundObject` to `yjsBindingContext` so it's easier to access the root bound object from the context.

## 1.3.0

- Frozen values will be stored as plain values in Y.js instead of being deeply converted to Y.js Maps/Arrays, etc. This means storing/fetching frozen values should be faster, require less memory and probably require less space in the Y.js state.

## 1.2.0

- Added `yjsBindingContext` so bound objects offer a context with the Y.js doc, bound object, etc.

## 1.1.0

- Added the `convertJsonToYjsData`, `applyJsonArrayToYArray` and `applyJsonObjectToYMap` functions to help with first migrations from snapshots to Y.js states.

## 1.0.0

- First public release.
