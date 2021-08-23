import {
  creationDataTypeSymbol,
  dataTypeSymbol,
  ModelClass,
  transformedCreationDataTypeSymbol,
  transformedDataTypeSymbol,
} from "../modelShared/BaseModelShared"
import { modelInfoByClass } from "../modelShared/modelInfo"
import { getInternalModelClassPropsInfo } from "../modelShared/modelPropsInfo"
import { noDefaultValue } from "../modelShared/prop"
import { getSnapshot } from "../snapshot/getSnapshot"
import { isTreeNode } from "../tweaker/core"
import { toTreeNode } from "../tweaker/tweak"
import { typesDataModelData } from "../typeChecking/dataModelData"
import { typeCheck } from "../typeChecking/typeCheck"
import type { TypeCheckError } from "../typeChecking/TypeCheckError"
import { failure, isObject } from "../utils"
import { getOrCreate } from "../utils/mapUtils"
import type { DataModelConstructorOptions } from "./DataModelConstructorOptions"
import { internalNewDataModel } from "./newDataModel"
import { setBaseDataModel } from "./_BaseDataModel"

const dataModelInstanceCache = new WeakMap<ModelClass<AnyDataModel>, WeakMap<any, AnyDataModel>>()

/**
 * Base abstract class for data models. Use `DataModel` instead when extending.
 *
 * Never override the constructor, use `onLazyInit` instead.
 *
 * @typeparam Data Props data type.
 */
export abstract class BaseDataModel<
  Data extends { [k: string]: any },
  CreationData extends { [k: string]: any },
  TransformedData extends { [k: string]: any },
  TransformedCreationData extends { [k: string]: any }
> {
  // just to make typing work properly
  [dataTypeSymbol]: Data;
  [creationDataTypeSymbol]: Data;
  [transformedDataTypeSymbol]: TransformedData;
  [transformedCreationDataTypeSymbol]: Data

  /**
   * Called after the instance is created when there's the first call to `fn(M, data)`.
   */
  protected onLazyInit?(): void

  /**
   * Data part of the model, which is observable and will be serialized in snapshots.
   * Use it if one of the data properties matches one of the model properties/functions.
   * This also allows access to the backed values of transformed properties.
   */
  readonly $!: Data

  /**
   * Performs a type check over the model instance.
   * For this to work a data type has to be declared as part of the model properties.
   *
   * @returns A `TypeCheckError` or `null` if there is no error.
   */
  typeCheck(): TypeCheckError | null {
    const type = typesDataModelData<this>(this.constructor as any)
    return typeCheck(type, this.$ as any)
  }

  /**
   * Creates an instance of a data model.
   */
  constructor(data: CreationData | TransformedCreationData) {
    if (!isObject(data)) {
      throw failure("data models can only work over data objects")
    }

    const { modelClass: _modelClass }: DataModelConstructorOptions = arguments[1] as any
    const modelClass = _modelClass!

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

      const initialData: Record<string, any> = Object.assign({}, data)

      const modelPropsKeys = Object.keys(modelProps)
      for (let i = 0; i < modelPropsKeys.length; i++) {
        const k = modelPropsKeys[i]
        const propData = modelProps[k]

        let newValue = initialData![k]
        let changed = false

        // apply untransform (if any)
        if (propData.transform) {
          changed = true
          newValue = propData.transform.untransform(newValue, this, k)
        }

        // apply default value (if needed)
        if (newValue == null) {
          if (propData.defaultFn !== noDefaultValue) {
            changed = true
            newValue = propData.defaultFn()
          } else if (propData.defaultValue !== noDefaultValue) {
            changed = true
            newValue = propData.defaultValue
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
      return instance
    }

    instancesForModelClass.set(tweakedData, this)

    Object.setPrototypeOf(this, modelClass.prototype)

    const self = this as any

    // delete unnecessary props
    delete self[dataTypeSymbol]
    delete self[creationDataTypeSymbol]
    delete self[transformedDataTypeSymbol]
    delete self[transformedCreationDataTypeSymbol]

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

setBaseDataModel(BaseDataModel)

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
export interface AnyDataModel extends BaseDataModel<any, any, any, any> {}

/**
 * A data model class declaration, made of a base model and the model interface.
 */
export type DataModelClassDeclaration<BaseModelClass, ModelInterface> = BaseModelClass & {
  (...args: any[]): ModelInterface
}
