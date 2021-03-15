import type { AnyDataModel } from "../dataModel/BaseDataModel"
import type { AnyModel } from "../model/BaseModel"

/**
 * @ignore
 */
export const propsDataTypeSymbol = Symbol()

/**
 * @ignore
 */
export const propsCreationDataTypeSymbol = Symbol()

/**
 * @ignore
 */
export const instanceDataTypeSymbol = Symbol()

/**
 * @ignore
 */
export const instanceCreationDataTypeSymbol = Symbol()

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
 export type AbstractModelClass<M extends AnyModel|AnyDataModel> = abstract new (initialData: any) => M;

/**
 * The props data type of a model.
 */
export type ModelPropsData<M extends AnyModel | AnyDataModel> = M["$"]

/**
 * The props creation data type of a model.
 */
export type ModelPropsCreationData<
  M extends AnyModel
> = M[typeof propsCreationDataTypeSymbol]

/**
 * The instance data type of a model.
 */
export type ModelInstanceData<M extends AnyModel | AnyDataModel> = M[typeof instanceDataTypeSymbol]

/**
 * The transformed creation data type of a model.
 */
export type ModelInstanceCreationData<
  M extends AnyModel
> = M[typeof instanceCreationDataTypeSymbol]

/**
 * Tricks Typescript into accepting a particular kind of generic class as a parameter for `ExtendedModel`.
 * Does nothing in runtime.
 *
 * @typeparam T Generic model class type.
 * @param type Generic model class.
 * @returns
 */
export function modelClass<T extends AnyModel | AnyDataModel>(type: { prototype: T }): ModelClass<T> {
  return type as any
}
