# Change Log

## 0.54.0

- Added `withGroupFlow` to `UndoManager` so that several async actions can be undone/redone as a single step.

## 0.53.0

- [BREAKING CHANGE] Now requires TypeScript 4.2.0.
- [BREAKING CHANGE] Class model `setterAction: true` prop option will now generate a setter like `setX` automatically instead of making the property assignable. To get the old behaviour use `setterAction: "assign"` instead.
- [BREAKING CHANGE] Functional model `setterActions` now just take the field names rather than an object with the setter mapping.
- Fixed an issue when using `ExtendedModel` with abstract classes in Typescript 4.2.0.
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
