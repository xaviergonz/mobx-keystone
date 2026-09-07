# Change Log

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
