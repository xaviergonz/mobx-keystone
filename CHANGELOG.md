# Change Log

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
