import type { AnyDataModel } from "../dataModel/BaseDataModel"
import type { AnyModel } from "../model/BaseModel"
import type { ModelClass } from "./BaseModelShared"

/**
 * Information about a registered model.
 */
export interface ModelInfo {
  name: string
  class: ModelClass<AnyModel | AnyDataModel>
}

/**
 * @internal
 */
export const modelInfoByName: {
  [name: string]: ModelInfo
} = Object.create(null)

/**
 * @internal
 */
export const modelInfoByClass = new WeakMap<ModelClass<AnyModel | AnyDataModel>, ModelInfo>()

// registered model prototypes (looked up rather than reading `constructor`, since that might be
// a model prop)
const modelInfoByPrototype = new WeakMap<object, ModelInfo>()

// for each registered model, how many registered models below each of its base models
// (including itself, at 0) it is, by name
const ancestorDistancesByModelInfo = new WeakMap<ModelInfo, ReadonlyMap<string, number>>()
// the same, by name for the current registration of each model name
const ancestorDistancesByModelName = new Map<string, ReadonlyMap<string, number>>()

/**
 * Finds the info of the first registered model class in a prototype chain.
 *
 * @internal
 */
export function findModelInfoForPrototype(proto: object | null): ModelInfo | undefined {
  for (let p = proto; p; p = Object.getPrototypeOf(p)) {
    const modelInfo = modelInfoByPrototype.get(p)
    if (modelInfo) {
      return modelInfo
    }
  }
  return undefined
}

/**
 * Registers a model.
 *
 * @internal
 */
export function setModelInfo(modelInfo: ModelInfo, unwrappedClass: ModelClass<any>): void {
  // the base classes were registered before, so their distances are already known; names are
  // used rather than classes since with hot reloading a subclass might still extend a previous
  // registration of a model
  const baseModelInfo = findModelInfoForPrototype(Object.getPrototypeOf(unwrappedClass.prototype))
  const ancestorDistances = new Map<string, number>()
  baseModelInfo &&
    ancestorDistancesByModelInfo.get(baseModelInfo)?.forEach((distance, name) => {
      ancestorDistances.set(name, distance + 1)
    })
  ancestorDistances.set(modelInfo.name, 0)
  ancestorDistancesByModelInfo.set(modelInfo, ancestorDistances)
  ancestorDistancesByModelName.set(modelInfo.name, ancestorDistances)

  modelInfoByName[modelInfo.name] = modelInfo
  modelInfoByClass.set(modelInfo.class, modelInfo)
  modelInfoByClass.set(unwrappedClass, modelInfo)
  modelInfoByPrototype.set(unwrappedClass.prototype, modelInfo)
}

/**
 * How many registered models a model is below a base model (0 if it is that model), or -1 if
 * it does not extend it.
 *
 * @internal
 */
export function getModelSubclassDistance(modelInfo: ModelInfo, baseModelName: string): number {
  return ancestorDistancesByModelInfo.get(modelInfo)?.get(baseModelName) ?? -1
}

/**
 * How many registered models the model currently registered with a name is below a base model
 * (0 if it is that model), -1 if it does not extend it, or `undefined` if the name is not
 * registered.
 *
 * @internal
 */
export function getModelSubclassDistanceForName(
  modelName: string,
  baseModelName: string
): number | undefined {
  const ancestorDistances = ancestorDistancesByModelName.get(modelName)
  return ancestorDistances ? (ancestorDistances.get(baseModelName) ?? -1) : undefined
}

/**
 * Returns the model info for a model type name, or `undefined` if not found.
 *
 * @param name The model type name (from `$modelType`).
 * @returns The model info or `undefined`.
 */
export function getModelInfoForName(name: string): ModelInfo | undefined {
  return modelInfoByName[name]
}

/**
 * Builds a helpful error message when a model type cannot be resolved from the runtime registry.
 *
 * @param name The model type name (from `$modelType`).
 * @returns A diagnostic message with common remediation steps.
 */
export function getModelNotRegisteredErrorMessage(name: string): string {
  return (
    `model with name "${name}" not found in the registry. ` +
    "This usually means the model module was not imported at runtime " +
    "(for example, due to type-only imports or import elision). " +
    "Import the model module for side effects, use runtime model references " +
    "(for example `tProp(types.model(MyModel))` or `fromSnapshot(MyModel, snapshot)`), " +
    "or call `registerModels(MyModel)` during startup."
  )
}
