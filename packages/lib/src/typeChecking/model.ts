import { O } from "ts-toolbelt"
import { AnyModel, ModelClass } from "../model/BaseModel"
import { getModelDataType } from "../model/getModelDataType"
import { getModelValidationType } from "../model/getModelValidationType"
import { modelInfoByClass } from "../model/modelInfo"
import { getInternalModelClassPropsInfo } from "../model/modelPropsInfo"
import { noDefaultValue } from "../model/prop"
import { assertIsModelClass, isModelClass } from "../model/utils"
import { failure, lateVal } from "../utils"
import { resolveTypeChecker } from "./resolveTypeChecker"
import { AnyStandardType, IdentityType } from "./schemas"
import { getTypeInfo, lateTypeChecker, TypeChecker, TypeInfo, TypeInfoGen } from "./TypeChecker"
import { createTypeCheckError, mergeTypeCheckErrors, TypeCheckErrors } from "./TypeCheckErrors"

const cachedModelTypeChecker = new WeakMap<ModelClass<AnyModel>, TypeChecker>()

/**
 * A type that represents a model. The type referenced in the model decorator will be used for type checking.
 *
 * Example:
 * ```ts
 * const someModelType = types.model<SomeModel>(SomeModel)
 * // or for recursive models
 * const someModelType = types.model<SomeModel>(() => SomeModel)
 * ```
 *
 * @typeparam M Model type.
 * @param modelClass Model class.
 * @returns
 */
export function typesModel<M = never>(modelClass: object): IdentityType<M> {
  // if we type it any stronger then recursive defs and so on stop working

  if (!isModelClass(modelClass) && typeof modelClass === "function") {
    // resolve later
    const typeInfoGen: TypeInfoGen = (t) => new ModelTypeInfo(t, modelClass())
    return lateTypeChecker(() => typesModel(modelClass()) as any, typeInfoGen) as any
  } else {
    const modelClazz: ModelClass<AnyModel> = modelClass as any
    assertIsModelClass(modelClazz, "modelClass")

    const cachedTypeChecker = cachedModelTypeChecker.get(modelClazz)
    if (cachedTypeChecker) {
      return cachedTypeChecker as any
    }

    const typeInfoGen: TypeInfoGen = (t) => new ModelTypeInfo(t, modelClazz)

    const tc = lateTypeChecker(() => {
      const modelInfo = modelInfoByClass.get(modelClazz)!
      const typeName = `Model(${modelInfo.name})`

      return new TypeChecker(
        (value, path) => {
          if (!(value instanceof modelClazz)) {
            return createTypeCheckError(path, typeName, value)
          }

          const dataTypeChecker = getModelDataType(value)
          const validationTypeChecker = getModelValidationType(value)
          if (!dataTypeChecker && !validationTypeChecker) {
            throw failure(
              `type checking cannot be performed over model of type '${
                modelInfo.name
              }' at path ${path.join(
                "/"
              )} since that model type has no data type declared, consider adding a data type or using types.unchecked() instead`
            )
          }

          let dataErrors: TypeCheckErrors | null | undefined
          if (dataTypeChecker) {
            const resolvedTc = resolveTypeChecker(dataTypeChecker)
            if (!resolvedTc.unchecked) {
              dataErrors = resolvedTc.check(value.$, [...path, "$"])
            }
          }

          let validationErrors: TypeCheckErrors | null | undefined
          if (validationTypeChecker) {
            const resolvedTc = resolveTypeChecker(validationTypeChecker)
            if (!resolvedTc.unchecked) {
              validationErrors = resolvedTc.check(value, path)
            }
          }

          if (dataErrors && validationErrors) {
            return mergeTypeCheckErrors("and", [dataErrors, validationErrors])
          } else if (dataErrors) {
            return dataErrors
          } else if (validationErrors) {
            return validationErrors
          }

          return null
        },
        () => typeName,
        typeInfoGen
      )
    }, typeInfoGen) as any

    cachedModelTypeChecker.set(modelClazz, tc)

    return tc as any
  }
}

/**
 * `types.model` type info for a model props.
 */
export interface ModelTypeInfoProps {
  readonly [propName: string]: Readonly<{
    type: AnyStandardType | undefined
    typeInfo: TypeInfo | undefined
    hasDefault: boolean
    default: any
  }>
}

/**
 * `types.model` type info.
 */
export class ModelTypeInfo extends TypeInfo {
  private _props = lateVal(() => {
    const objSchema = getInternalModelClassPropsInfo(this.modelClass)

    const propTypes: O.Writable<ModelTypeInfoProps> = {}
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

  get props(): ModelTypeInfoProps {
    return this._props()
  }

  get modelType(): string {
    const modelInfo = modelInfoByClass.get(this.modelClass)!
    return modelInfo.name
  }

  constructor(thisType: AnyStandardType, readonly modelClass: ModelClass<AnyModel>) {
    super(thisType)
  }
}
