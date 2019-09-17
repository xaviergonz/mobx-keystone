# Change Log

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

- Fixed an issue with ExtendsModel when user library was compiled using ES6 classes.

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

- Added `ExtendsModel` and a doc section about subclassing.

## 0.11.4

- Slight performance bump by moving decorators to the prototype.

## 0.11.0

- Fixed compatibility with mobx4.

## 0.10.0

- Added a second parameter to `getParent` to skip model interim data objects.
- Added `isModelDataObject` function.

## 0.9.14

- First public release.
