import type { AnyDataModel } from "../dataModel/BaseDataModel"
import type { AnyModel } from "../model/BaseModel"

/**
 * @ignore
 */
export const dataTypeSymbol = Symbol()

/**
 * @ignore
 */
export const creationDataTypeSymbol = Symbol()

/**
 * @ignore
 */
export const transformedDataTypeSymbol = Symbol()

/**
 * @ignore
 */
export const transformedCreationDataTypeSymbol = Symbol()

/**
 * @ignore
 * @internal
 */
export const modelInitializedSymbol = Symbol("modelInitialized")

/**
 * Extracts the instance type of a model class.
 */
export type ModelClass<M extends AnyModel | AnyDataModel> = {
  new (initialData: any): M
}

/**
 * Extracts the instance type of an abstract model class.
 */
export type AbstractModelClass<M extends AnyModel | AnyDataModel> = abstract new (
  initialData: any
) => M

/**
 * The data type of a model.
 */
export type ModelData<M extends AnyModel | AnyDataModel> = M["$"]

/**
 * The creation data type of a model.
 */
export type ModelCreationData<M extends AnyModel | AnyDataModel> = M[typeof creationDataTypeSymbol]

/**
 * The transformed data type of a model.
 */
export type ModelTransformedData<M extends AnyModel | AnyDataModel> =
  M[typeof transformedDataTypeSymbol]

/**
 * The transformed creation data type of a model.
 */
export type ModelTransformedCreationData<M extends AnyModel | AnyDataModel> =
  M[typeof transformedCreationDataTypeSymbol]

/**
 * Tricks Typescript into accepting a particular kind of generic class as a parameter for `ExtendedModel`.
 * Does nothing in runtime.
 *
 * @typeparam T Generic model class type.
 * @param type Generic model class.
 * @returns
 */
export function modelClass<T extends AnyModel | AnyDataModel>(type: {
  prototype: T
}): ModelClass<T> {
  return type as any
}
