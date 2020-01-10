# Change Log

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

- `onAttachedToRootStore` and its disposer will be called right after a change is made rather than after a whole action is finished (restores behaviour of version <= 0.28.1).

## 0.28.3

- Improve a bit the atomicity of `modelAction` / `runUnprotected`.

## 0.28.2

- Fix: modifying a node inside `onAttachedToRootStore` or its returned disposer no longer results in broken snapshots.

## 0.28.1

- Updated min Typescript version to 3.7.

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

- Made it impossible in Typescript to give a default value for an object type without using a default value generator function to avoid possible mistakes.

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
