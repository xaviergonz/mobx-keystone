import type { O } from "ts-toolbelt"
import type { AnyModel } from "../../model/BaseModel"
import { getModelMetadata } from "../../model/getModelMetadata"
import { modelTypeKey } from "../../model/metadata"
import { isModelClass } from "../../model/utils"
import type { ModelClass } from "../../modelShared/BaseModelShared"
import { modelInfoByClass } from "../../modelShared/modelInfo"
import { getInternalModelClassPropsInfo } from "../../modelShared/modelPropsInfo"
import { noDefaultValue } from "../../modelShared/prop"
import { isObject, lazy } from "../../utils"
import { TypeCheckError } from "../TypeCheckError"
import {
  TypeChecker,
  TypeCheckerBaseType,
  TypeInfo,
  TypeInfoGen,
  lateTypeChecker,
} from "../TypeChecker"
import { getTypeInfo } from "../getTypeInfo"
import { registerStandardTypeResolver, resolveTypeChecker } from "../resolveTypeChecker"
import type { AnyStandardType, ModelType } from "../schemas"

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
export function typesModel<M = never, K = M>(modelClass: _ClassOrObject<M, K>): ModelType<K> {
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
      const resolvedDataTypeChecker = dataTypeChecker
        ? resolveTypeChecker(dataTypeChecker)
        : undefined

      const thisTc: TypeChecker = new TypeChecker(
        TypeCheckerBaseType.Object,

        (value, path, typeCheckedValue) => {
          if (!(value instanceof modelClazz)) {
            return new TypeCheckError(path, typeName, value, typeCheckedValue)
          }

          if (resolvedDataTypeChecker) {
            return resolvedDataTypeChecker.check(value.$, path, typeCheckedValue)
          }

          return null
        },
        () => typeName,
        typeInfoGen,

        (value) => {
          if (!isObject(value)) {
            return null
          }

          if (value[modelTypeKey] !== undefined) {
            // fast check
            return value[modelTypeKey] === modelInfo.name ? thisTc : null
          }

          if (resolvedDataTypeChecker) {
            return resolvedDataTypeChecker.snapshotType(value) ? thisTc : null
          }

          // not enough info to be able to tell
          return null
        },

        (sn) => {
          if (sn[modelTypeKey]) {
            return sn
          } else {
            return {
              ...sn,
              [modelTypeKey]: modelInfo.name,
            }
          }
        },

        (sn) => sn
      )

      return thisTc
    }, typeInfoGen) as any

    cachedModelTypeChecker.set(modelClazz, tc)

    return tc
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
  private _props = lazy(() => {
    const objSchema = getInternalModelClassPropsInfo(this.modelClass)

    const propTypes: O.Writable<ModelTypeInfoProps> = {}
    Object.keys(objSchema).forEach((propName) => {
      const propData = objSchema[propName]

      const type = propData._typeChecker as any as AnyStandardType | undefined

      let typeInfo: TypeInfo | undefined
      if (type) {
        typeInfo = getTypeInfo(type)
      }

      let hasDefault = false
      let defaultValue: any
      if (propData._defaultFn !== noDefaultValue) {
        defaultValue = propData._defaultFn
        hasDefault = true
      } else if (propData._defaultValue !== noDefaultValue) {
        defaultValue = propData._defaultValue
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

  constructor(
    thisType: AnyStandardType,
    readonly modelClass: ModelClass<AnyModel>
  ) {
    super(thisType)
  }
}

/**
 * @internal
 */
export function registerModelStandardTypeResolver() {
  registerStandardTypeResolver((v) => (isModelClass(v) ? typesModel(v) : undefined))
}
