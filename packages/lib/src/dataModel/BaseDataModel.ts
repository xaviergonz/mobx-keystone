import {
  instanceDataTypeSymbol,
  ModelClass,
  ModelPropsData,
  propsDataTypeSymbol,
} from "../modelShared/BaseModelShared"
import { modelInfoByClass } from "../modelShared/modelInfo"
import { getSnapshot } from "../snapshot/getSnapshot"
import { toTreeNode } from "../tweaker/tweak"
import { typesDataModelData } from "../typeChecking/dataModelData"
import { typeCheck } from "../typeChecking/typeCheck"
import type { TypeCheckError } from "../typeChecking/TypeCheckError"
import { failure, isObject } from "../utils"
import type { DataModelConstructorOptions } from "./DataModelConstructorOptions"
import { internalNewDataModel } from "./newDataModel"
import { setBaseDataModel } from "./_BaseDataModel"

const dataModelInstanceCache = new WeakMap<ModelClass<AnyDataModel>, WeakMap<any, AnyDataModel>>()

/**
 * Base abstract class for data models. Use `DataModel` instead when extending.
 *
 * Never override the constructor, use `onLazyInit` instead.
 *
 * @typeparam PropsData Props data type.
 * @typeparam InstanceData Instace data type.
 */
export abstract class BaseDataModel<
  PropsData extends { [k: string]: any },
  InstanceData extends { [k: string]: any } = PropsData
> {
  // just to make typing work properly
  [propsDataTypeSymbol]: PropsData;
  [instanceDataTypeSymbol]: InstanceData

  /**
   * Called after the instance is created when there's the first call to `fn(M, data)`.
   */
  onLazyInit?(): void

  /**
   * Data part of the model, which is observable and will be serialized in snapshots.
   * Use it if one of the data properties matches one of the model properties/functions.
   * This also allows access to the backed values of transformed properties.
   */
  readonly $!: PropsData

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
  constructor(data: PropsData) {
    if (!isObject(data)) {
      throw failure("data models can only work over data objects")
    }
    const tweakedData = toTreeNode(data)

    const { modelClass: _modelClass }: DataModelConstructorOptions = arguments[1] as any
    const modelClass = _modelClass!

    let instancesForModelClass = dataModelInstanceCache.get(modelClass)
    if (!instancesForModelClass) {
      instancesForModelClass = new WeakMap()
      dataModelInstanceCache.set(modelClass, instancesForModelClass)
    }

    const instance = instancesForModelClass.get(tweakedData)
    if (instance) {
      return instance
    }

    instancesForModelClass.set(tweakedData, this)

    Object.setPrototypeOf(this, modelClass.prototype)

    const self = this as any

    // delete unnecessary props
    delete self[propsDataTypeSymbol]
    delete self[instanceDataTypeSymbol]

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

// these props will never be hoisted to this
/**
 * @internal
 */
export const baseDataModelPropNames = new Set<keyof AnyDataModel>(["onLazyInit", "$", "typeCheck"])

/**
 * Any kind of data model instance.
 */
export interface AnyDataModel extends BaseDataModel<any, any> {}

/**
 * A data model class declaration, made of a base model and the model interface.
 */
export type DataModelClassDeclaration<BaseModelClass, ModelInterface> = BaseModelClass & {
  (...args: any[]): ModelInterface
}

/**
 * Data type for a data model.
 */
export type DataModelData<M extends AnyDataModel> = ModelPropsData<M>
