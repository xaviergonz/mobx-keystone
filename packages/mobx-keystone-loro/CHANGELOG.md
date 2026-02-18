# Change Log

## Unreleased

## 1.0.0

- Refactored internal synchronization to use deep change observation instead of JSON patches. This provides proper array splice detection, avoiding the previous behavior where array operations were converted to individual element patches. The result is more efficient array synchronization and better alignment with how Loro handles array modifications.
- Added `moveWithinArray(array, fromIndex, toIndex)` helper function for explicit array move operations. When used on a bound array, this translates to a native Loro `move()` operation, preserving item identity and history across clients. This replaces the previous automatic move detection logic which was complex and less predictable.
- Fixed a synchronization issue where values added to a collection and then mutated within the same action could cause desync. Snapshots are now captured at change time rather than at action completion time.
- Initial release of `mobx-keystone-loro`.
