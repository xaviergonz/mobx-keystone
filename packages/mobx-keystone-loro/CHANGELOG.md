# Change Log

## Unreleased

- Keep published JSON converter type declarations self-contained, avoiding an unresolved dependency on the private CRDT helper package.
- Avoided reading native container ids and allocating throwaway reactive atoms while resolving Loro paths outside a MobX derivation, such as when writing local changes back to the document.
- Keep local array writes synchronized when a commit also carries pending native list edits. Insertions, deletions, updates and moves whose indices the native side has shifted, reordered or replaced now reconcile instead of failing and leaving the model and document diverged. Unaffected paths keep their incremental updates and native moves.
- Flush queued reentrant moves when a native commit lands before the surrounding model action finishes, instead of replaying them against a document that has already moved on.
- `LoroTextModel.withText("")` now stores an empty delta list, matching what Loro stores for empty text, so its snapshot no longer differs from the document forever.
- Track list positions locally while reconciling model order, replacing a document-wide container search per item.
- Skip incoming map events that only restate what the model already holds even when the commit also touches other bindings or carries empty diffs.
- Remove stale native copies of locally written models during conflicting array reconciliation, preventing duplicate model IDs after positional edits or insertion/reordering spans.
- Restore locally edited primitive array entries after pending native deletions without creating sparse arrays or failing synchronization.
- With the updated core, keep synchronizing when an earlier model listener unsubscribes itself during change delivery.
- With the updated core, synchronize applied edits even when an earlier global or subtree deep-change listener throws.
- Preserve validated native moves when a subtree deep-change listener throws, including nested moves and pending native field edits. Rejected moves remain excluded from synchronization.
- Preserve native model ordering when reconciliation combines model field edits with positional edits to non-model array entries.
- Avoid an extra native array read when reconciling primitive arrays.
- Avoid reading unrelated collections when a commit combines native and local map-only edits. Related map changes still validate together with automatic type checking enabled.
- Restore locally edited models removed by pending native deletions without overwriting surviving models or creating sparse arrays. Restored values are placed relative to surviving neighbors, while unrelated native replacements remain intact.
- Apply local model field edits at the model's pending native position, preserving native reordering and unrelated insertions/deletions instead of duplicating models at stale array indices.
- Detect conflicting pending native model identities along locally edited paths, including ordinary edits, and reconcile those conflicts as whole model values. Unchanged identities keep incremental outgoing updates.
- Resolve conflicting model types and IDs atomically during startup and reentrant reconciliation, preventing fields from different model identities from producing invalid snapshots. Unchanged source values still preserve concurrent replacements.
- Validate `moveWithinArray` atomically on observable arrays: fixed-length refinements accept valid moves, and rejected moves leave the original array intact. Preserve native replay order for nested moves and reconcile intervening listener insertions before later moves.
- Reconcile local edits made by deep-change listeners even when child and ancestor notifications overlap. Unrelated pending native fields and array values are preserved, including fields of reordered models; ordinary changes remain incremental. Reordering identified models also preserves their native containers and nested text containers. Explicit `moveWithinArray` calls inside listeners retain native moves for primitives and plain objects too, including pending native values.
- Prevented startup model replacements from inheriting initialization edits belonging to the previous model ID or type, including transitions between models and plain objects. Publishing unchanged inferred metadata still preserves initialization edits.
- With the updated core, rejected individual local mutations no longer write CRDT operations or compete with concurrent native edits
- Stopped changed-value scans after two differences when selecting atomic typed-map updates, avoiding redundant native reads for large map events.
- Fixed snapshot processor previews and custom model ID detection after list index shifts, avoiding stale-model reads during combined list and child edits.
- Preserved native startup edits that overlap a value replaced with a frozen value during model initialization. The conflicting native value now replaces the initialized frozen value atomically.
- Preserved native edits made during initialization and binding-context activation, including changes from newly initialized descendants, while retaining unrelated model defaults and initialization edits.
- Recovered synchronization after rejected native commits by reconciling the current native snapshot until validation succeeds, then resuming incremental updates.
- Restored model defaults after list index shifts and skipped processing native model map changes that return to their original values.
- Compared frozen values and snapshots using JSON data semantics, including object-valued `constructor` keys, avoiding redundant CRDT writes.
- Limited reactive text-path invalidation to changed map keys and nonempty list changes, and released unused path dependencies.
- Applied incoming model values in their stored form, restored deleted/nullish defaults, and ran snapshot processors with normalized values synchronized back to Loro.
- Preserved identities during nested model ID changes, moves between collections, and replacement of wrappers containing identified models. Structural synchronization retains unchanged snapshot branches.
- Synchronized missing model metadata during initialization and avoided replaying list edits already loaded before their first commit.
- Made incoming plain-object additions observable without MobX proxies, and preserved references for unchanged frozen values.
- Automatically disposed bindings whose containers were deleted, ignored callbacks after disposal, and prevented disposal reactions from writing to Loro.
- Applied contiguous native list replacements in one mutation and combined separated edits under typed models, preserving whole-list refinements. Multi-key map updates and commits spanning containers under a shared typed ancestor validate their completed state.
- Avoided redundant NaN merge writes and text rewrites for equivalent spans or consecutive replacements reverted within one action.
- Ignore initialization changes in unrelated helper models, avoiding unnecessary merges and accidental commits of pending document edits.
- Read existing list contents in bulk during merges, after trimming removed items, and avoid allocating a source-key set for map merges.
- Ignore commits confined to other top-level document roots, avoiding premature flushes and full-root reconciliation when separate bindings are edited in one action.
- Reconcile incoming initialization hooks that edit existing bound nodes, preventing sibling updates in the same batch from leaving the model and Loro out of sync.
- Preserve both model instances when a Loro map update swaps sibling model snapshots, including required typed properties and simultaneous content changes.
- Skip unchanged rich-text replacements, avoiding redundant CRDT writes that disturb concurrent insertion positions.
- Set binding origins at commit time so failed writes do not cause subsequent direct Loro commits to be ignored or overwrite the caller's pending origin.
- Ignore empty formatted text spans during conversion and unbound editing instead of throwing on empty mark ranges.
- Batch adjacent rich-text spans into one native insertion while preserving their formatting.
- Skip unchanged frozen values during snapshot merges, avoiding redundant list writes that can overwrite concurrent edits.
- Preserve list item identity when merging replacement values, so concurrent moves do not resurrect the old value beside its replacement.
- Skip array mutations for moves that leave an item in its current position.
- Reject detached or unreachable containers before binding, and install binding listeners only after initialization succeeds.
- Reject undefined and sparse list entries instead of silently converting them to null.
- Avoid redundant model path traversal when detecting local array moves.
- Serialize inserted Loro subtrees in one traversal and read list contents in bulk, reducing container access overhead.
- Avoid re-resolving unchanged `loroText` references after scalar property and array-element updates.
- Reconcile nested model type changes from Loro by replacing the model instance, including transitions back to plain objects. Bound root model types cannot change in place.
- Refresh cached `loroText` references after remote container replacement so subsequent edits reach the current container.
- Preserve rich-text formatting when editing an unbound `LoroTextModel`.
- Provide binding context during initialization of models created by Loro events.
- Keep queued model changes and direct Loro edits synchronized when their commits overlap.
- Preserve own `__proto__` properties when converting Loro data to snapshots.
- Fixed nested bindings following the wrong container after a parent list move or container replacement.
- Fixed stale `LoroTextModel.currentDelta` observations and synchronization of `insertText` / `deleteText`; these methods now commit their Loro edits immediately.
- Fixed disposed text bindings continuing to modify the Loro document, and made the binding context synchronization flag reflect its current state.
- Fixed merges ignoring changes when a source object is reused, and incorrectly converting frozen values or text snapshots into maps. Removed the unsafe snapshot-reference cache.
- Preserve existing text containers when merging snapshots or applying model defaults.
- Fixed model identity preservation for remote list moves in both directions and model replacement with the same ID but a different type.
- Reject non-integer move indices before mutating the array and consistently use `MobxKeystoneLoroError` for conversion and move validation errors.
- Skip subtrees that snapshot reconciliation left untouched when writing back to Loro, instead of reading the whole document back and comparing it key by key. Reentrant changes and commits that mix local and native edits no longer scan unrelated maps and lists.

## 1.1.1

- Fixed stale model contents when a Loro container replacement reuses an existing model ID.
- Fixed a synchronization issue where a change coming from Loro that assigned a whole submodel or array to a model property could be applied with its array contents duplicated, since the events for the nested containers were replayed on top of the already revived subtree.

## 1.1.0

- Declared compatibility with MobX 7.
- Updated the `mobx-keystone` peer requirement to `^1.24.0` to use the public MobX compatibility decorators.

## 1.0.0

- Refactored internal synchronization to use deep change observation instead of JSON patches. This provides proper array splice detection, avoiding the previous behavior where array operations were converted to individual element patches. The result is more efficient array synchronization and better alignment with how Loro handles array modifications.
- Added `moveWithinArray(array, fromIndex, toIndex)` helper function for explicit array move operations. When used on a bound array, this translates to a native Loro `move()` operation, preserving item identity and history across clients. This replaces the previous automatic move detection logic which was complex and less predictable.
- Fixed a synchronization issue where values added to a collection and then mutated within the same action could cause desync. Snapshots are now captured at change time rather than at action completion time.
- Initial release of `mobx-keystone-loro`.
