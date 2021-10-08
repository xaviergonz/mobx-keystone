import type { O } from "ts-toolbelt"
import type { AnyModel } from "../model/BaseModel"
import { getModelMetadata } from "../model/getModelMetadata"
import { isModelClass } from "../model/utils"
import type { ModelClass } from "../modelShared/BaseModelShared"
import { modelInfoByClass } from "../modelShared/modelInfo"
import { getInternalModelClassPropsInfo } from "../modelShared/modelPropsInfo"
import { noDefaultValue } from "../modelShared/prop"
import { failure, lateVal } from "../utils"
import { getTypeInfo } from "./getTypeInfo"
import { resolveTypeChecker } from "./resolveTypeChecker"
import type { AnyStandardType, IdentityType } from "./schemas"
import { lateTypeChecker, TypeChecker, TypeInfo, TypeInfoGen } from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"

const cachedModelTypeChecker = new WeakMap<ModelClass<AnyModel>, TypeChecker>()

type _Class<T> = abstract new (...args: any[]) => T
type _ClassOrObject<M, K> = K extends M ? object : _Class<K> | (() => _Class<K>)

/**
 * A type that represents a model. The type referenced in the model decorator will be used for type checking.
 *
 * Example:
 * ```ts
 * const someModelType = types.model(SomeModel)
 * // or for recursive models
 * const someModelType = types.model<SomeModel>(() => SomeModel)
 * ```
 *
 * @typeparam M Model type.
 * @param modelClass Model class.
 * @returns
 */
export function typesModel<M = never, K = M>(modelClass: _ClassOrObject<M, K>): IdentityType<K> {
  // if we type it any stronger then recursive defs and so on stop working

  if (!isModelClass(modelClass) && typeof modelClass === "function") {
    // resolve later
    const modelClassFn = modelClass as () => ModelClass<AnyModel>
    const typeInfoGen: TypeInfoGen = (t) => new ModelTypeInfo(t, modelClassFn())
    return lateTypeChecker(() => typesModel(modelClassFn()) as any, typeInfoGen) as any
  } else {
    const modelClazz: ModelClass<AnyModel> = modelClass as any

    const cachedTypeChecker = cachedModelTypeChecker.get(modelClazz)
    if (cachedTypeChecker) {
      return cachedTypeChecker as any
    }

    const typeInfoGen: TypeInfoGen = (t) => new ModelTypeInfo(t, modelClazz)

    const tc = lateTypeChecker(() => {
      const modelInfo = modelInfoByClass.get(modelClazz)!
      const typeName = `Model(${modelInfo.name})`

      const dataTypeChecker = getModelMetadata(modelClazz).dataType
      if (!dataTypeChecker) {
        throw failure(
          `type checking cannot be performed over model of type '${modelInfo.name}' since that model type has no data type declared, consider adding a data type or using types.unchecked() instead`
        )
      }

      return new TypeChecker(
        (value, path) => {
          if (!(value instanceof modelClazz)) {
            return new TypeCheckError(path, typeName, value)
          }

          const resolvedTc = resolveTypeChecker(dataTypeChecker)
          if (!resolvedTc.unchecked) {
            return resolvedTc.check(value.$, path)
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

      const type = propData._internal.typeChecker as any as AnyStandardType

      let typeInfo: TypeInfo | undefined
      if (type) {
        typeInfo = getTypeInfo(type)
      }

      let hasDefault = false
      let defaultValue: any
      if (propData._internal.defaultFn !== noDefaultValue) {
        defaultValue = propData._internal.defaultFn
        hasDefault = true
      } else if (propData._internal.defaultValue !== noDefaultValue) {
        defaultValue = propData._internal.defaultValue
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
