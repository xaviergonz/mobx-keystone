# Change Log

## 1.6.0 (unreleased)

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
