import { type ModelClass, propsTypeSymbol } from "../modelShared/BaseModelShared"
import { modelInfoByClass } from "../modelShared/modelInfo"
import { getInternalModelClassPropsInfo } from "../modelShared/modelPropsInfo"
import {
  getModelPropStoredDefaultValue,
  type ModelProps,
  type ModelPropsToTransformedCreationData,
  type ModelPropsToUntransformedCreationData,
  type ModelPropsToUntransformedData,
  noDefaultValue,
} from "../modelShared/prop"
import { getSnapshot } from "../snapshot/getSnapshot"
import { isTreeNode } from "../tweaker/core"
import { toTreeNode } from "../tweaker/tweak"
import { typesDataModelData } from "../types/objectBased/typesDataModelData"
import type { TypeCheckError } from "../types/TypeCheckError"
import { typeCheck } from "../types/typeCheck"
import { clonePlainObject, failure, isObject } from "../utils"
import { getOrCreate } from "../utils/mapUtils"
import type { DataModelConstructorOptions } from "./DataModelConstructorOptions"
import { getDataModelMetadata } from "./getDataModelMetadata"
import { internalNewDataModel } from "./newDataModel"

const dataModelInstanceCache = new WeakMap<ModelClass<AnyDataModel>, WeakMap<any, AnyDataModel>>()

/**
 * Base abstract class for data models. Use `DataModel` instead when extending.
 *
 * Never override the constructor, use `onLazyInit` instead.
 *
 * @template Data Props data type.
 */
export abstract class BaseDataModel<TProps extends ModelProps> {
  // just to make typing work properly
  declare [propsTypeSymbol]: TProps

  /**
   * Called after the instance is created when there's the first call to `fn(M, data)`.
   */
  protected onLazyInit?(): void

  /**
   * Data part of the model, which is observable and will be serialized in snapshots.
   * Use it if one of the data properties matches one of the model properties/functions.
   * This also allows access to the backed values of transformed properties.
   */
  readonly $!: ModelPropsToUntransformedData<TProps>

  /**
   * Performs a type check over the model instance.
   * For this to work a data type has to be declared as part of the model properties.
   *
   * @returns A `TypeCheckError` or `null` if there is no error.
   */
  typeCheck(): TypeCheckError | null {
    // Data models without a dataType have nothing to check.
    if (!getDataModelMetadata(this.constructor as any).dataType) {
      return null
    }
    const type = typesDataModelData<this>(this.constructor as any)
    return typeCheck(type, this.$ as any)
  }

  /**
   * Creates an instance of a data model.
   */
  constructor(
    data:
      | ModelPropsToUntransformedCreationData<TProps>
      | ModelPropsToTransformedCreationData<TProps>
  ) {
    if (!isObject(data)) {
      throw failure("data models can only work over data objects")
    }

    const constructorOptions =
      // biome-ignore lint/complexity/noArguments: internal factory code passes hidden constructor options through super().
      arguments[1] as DataModelConstructorOptions
    const { modelClass: _modelClass } = constructorOptions
    const modelClass = _modelClass!

    type Data = ModelPropsToUntransformedData<TProps>
    let tweakedData: Data
    if (isTreeNode(data)) {
      // in theory already initialized
      tweakedData = data as any as Data
    } else {
      const modelInfo = modelInfoByClass.get(modelClass)
      if (!modelInfo) {
        throw failure(
          `no model info for class ${modelClass.name} could be found - did you forget to add the @model decorator?`
        )
      }

      const modelProps = getInternalModelClassPropsInfo(modelClass)

      const initialData: Record<string, any> = clonePlainObject(data)

      const modelPropsKeys = Object.keys(modelProps)
      for (let i = 0; i < modelPropsKeys.length; i++) {
        const k = modelPropsKeys[i]
        const propData = modelProps[k]

        let newValue = initialData[k]
        let changed = false

        // apply untransform (if any)
        const transform = propData._getTransform ? propData._getTransform() : propData._transform
        if (transform) {
          changed = true
          newValue = transform.untransform(newValue, this, k)
        }

        // apply default value (if needed)
        if (newValue == null) {
          const defaultValue = getModelPropStoredDefaultValue(propData, this, k)
          if (defaultValue !== noDefaultValue) {
            changed = true
            newValue = defaultValue
          }
        }

        if (changed) {
          initialData[k] = newValue
        }
      }

      tweakedData = toTreeNode(initialData as Data)
    }

    const instancesForModelClass = getOrCreate(
      dataModelInstanceCache,
      modelClass,
      () => new WeakMap()
    )

    const instance = instancesForModelClass.get(tweakedData)
    if (instance) {
      // biome-ignore lint/correctness/noConstructorReturn: no other way to return an instance
      return instance
    }

    instancesForModelClass.set(tweakedData, this)

    Object.setPrototypeOf(this, modelClass.prototype)

    internalNewDataModel(this, tweakedData as any, {
      modelClass,
    })
  }

  toString(options?: { withData?: boolean }) {
    const finalOptions = {
      withData: true,
      ...options,
    }

    const modelInfo = modelInfoByClass.get(this.constructor as any)

    const firstPart = `${this.constructor.name}#${modelInfo!.name}`

    return finalOptions.withData
      ? `[${firstPart} ${JSON.stringify(getSnapshot(this))}]`
      : `[${firstPart}]`
  }
}

/**
 * @ignore
 */
export type BaseDataModelKeys = keyof AnyDataModel | "onLazyInit"

// these props will never be hoisted to this
/**
 * @internal
 */
export const baseDataModelPropNames = new Set<BaseDataModelKeys>(["onLazyInit", "$", "typeCheck"])

/**
 * Any kind of data model instance.
 */
export interface AnyDataModel extends BaseDataModel<any> {}

/**
 * A data model class declaration, made of a base model and the model interface.
 */
export type DataModelClassDeclaration<BaseModelClass, ModelInterface> = BaseModelClass & {
  // biome-ignore lint/style/useShorthandFunctionType: make type recursive
  (...args: any[]): ModelInterface
}
