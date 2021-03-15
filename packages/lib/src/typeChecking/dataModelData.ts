import type { O } from "ts-toolbelt"
import type { AnyDataModel, DataModelData } from "../dataModel/BaseDataModel"
import { getDataModelMetadata } from "../dataModel/getDataModelMetadata"
import { isDataModelClass } from "../dataModel/utils"
import type { ModelClass } from "../modelShared/BaseModelShared"
import { modelInfoByClass } from "../modelShared/modelInfo"
import { getInternalModelClassPropsInfo } from "../modelShared/modelPropsInfo"
import { noDefaultValue } from "../modelShared/prop"
import { failure, lateVal } from "../utils"
import { getTypeInfo } from "./getTypeInfo"
import { resolveTypeChecker } from "./resolveTypeChecker"
import type { AnyStandardType, IdentityType } from "./schemas"
import { lateTypeChecker, TypeChecker, TypeInfo, TypeInfoGen } from "./TypeChecker"

const cachedDataModelTypeChecker = new WeakMap<ModelClass<AnyDataModel>, TypeChecker>()

/**
 * A type that represents a data model data.
 * The type referenced in the model decorator will be used for type checking.
 *
 * Example:
 * ```ts
 * const someDataModelDataType = types.dataModelData<SomeModel>(SomeModel)
 * // or for recursive models
 * const someDataModelDataType = types.dataModelData<SomeModel>(() => SomeModel)
 * ```
 *
 * @typeparam M Data model type.
 * @param modelClass Model class.
 * @returns
 */
export function typesDataModelData<M = never>(
  modelClass: object
): M extends AnyDataModel ? IdentityType<DataModelData<M>> : never {
  // if we type it any stronger then recursive defs and so on stop working

  if (!isDataModelClass(modelClass) && typeof modelClass === "function") {
    // resolve later
    const typeInfoGen: TypeInfoGen = (t) => new DataModelDataTypeInfo(t, modelClass())
    return lateTypeChecker(() => typesDataModelData(modelClass()) as any, typeInfoGen) as any
  } else {
    const modelClazz: ModelClass<AnyDataModel> = modelClass as any

    const cachedTypeChecker = cachedDataModelTypeChecker.get(modelClazz)
    if (cachedTypeChecker) {
      return cachedTypeChecker as any
    }

    const typeInfoGen: TypeInfoGen = (t) => new DataModelDataTypeInfo(t, modelClazz)

    const tc = lateTypeChecker(() => {
      const modelInfo = modelInfoByClass.get(modelClazz)!
      const typeName = `DataModelData(${modelInfo.name})`

      return new TypeChecker(
        (value, path) => {
          const dataTypeChecker = getDataModelMetadata(modelClazz).dataType
          if (!dataTypeChecker) {
            throw failure(
              `type checking cannot be performed over data model data of type '${
                modelInfo.name
              }' at path '${path.join(
                "/"
              )}' since that model type has no data type declared, consider adding a data type or using types.unchecked() instead`
            )
          }

          const resolvedTc = resolveTypeChecker(dataTypeChecker)
          if (!resolvedTc.unchecked) {
            return resolvedTc.check(value, path)
          }

          return null
        },
        () => typeName,
        typeInfoGen
      )
    }, typeInfoGen) as any

    cachedDataModelTypeChecker.set(modelClazz, tc)

    return tc as any
  }
}

/**
 * `types.dataModelData` type info for a model props.
 */
export interface DataModelDataTypeInfoProps {
  readonly [propName: string]: Readonly<{
    type: AnyStandardType | undefined
    typeInfo: TypeInfo | undefined
    hasDefault: boolean
    default: any
  }>
}

/**
 * `types.dataModelData` type info.
 */
export class DataModelDataTypeInfo extends TypeInfo {
  private _props = lateVal(() => {
    const objSchema = getInternalModelClassPropsInfo(this.modelClass)

    const propTypes: O.Writable<DataModelDataTypeInfoProps> = {}
    Object.keys(objSchema).forEach((propName) => {
      const propData = objSchema[propName]

      const type = (propData.typeChecker as any) as AnyStandardType

      let typeInfo: TypeInfo | undefined
      if (type) {
        typeInfo = getTypeInfo(type)
      }

      let hasDefault = false
      let defaultValue: any
      if (propData.defaultFn !== noDefaultValue) {
        defaultValue = propData.defaultFn
        hasDefault = true
      } else if (propData.defaultValue !== noDefaultValue) {
        defaultValue = propData.defaultValue
        hasDefault = true
      }

      propTypes[propName] = {
        type,
        typeInfo,
        hasDefault,
        default: defaultValue,
      }
    })
    return propTypes
  })

  get props(): DataModelDataTypeInfoProps {
    return this._props()
  }

  get modelType(): string {
    const modelInfo = modelInfoByClass.get(this.modelClass)!
    return modelInfo.name
  }

  constructor(thisType: AnyStandardType, readonly modelClass: ModelClass<AnyDataModel>) {
    super(thisType)
  }
}
