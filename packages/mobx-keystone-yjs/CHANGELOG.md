# Change Log

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
