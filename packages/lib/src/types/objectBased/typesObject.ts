import type { O } from "ts-toolbelt"
import { Frozen } from "../../frozen/Frozen"
import type { Path } from "../../parent/pathTypes"
import { isTweakedObject } from "../../tweaker/core"
import { assertIsFunction, assertIsObject, failure, isObject, lazy } from "../../utils"
import { withErrorPathSegment } from "../../utils/errorDiagnostics"
import { getTypeInfo } from "../getTypeInfo"
import { resolveStandardType, resolveTypeChecker } from "../resolveTypeChecker"
import type {
  AnyStandardType,
  AnyType,
  ModelType,
  ObjectTypeFunction,
  TypeToData,
} from "../schemas"
import { TypeCheckError } from "../TypeCheckError"
import {
  LateTypeChecker,
  lateTypeChecker,
  TypeChecker,
  TypeCheckerBaseType,
  TypeInfo,
  TypeInfoGen,
} from "../TypeChecker"
import { getChildCheckScope, isTypeCheckScopeAll, type TypeCheckScope } from "../typeCheckScope"

function typesObjectHelper<S>(objFn: S, frozen: boolean, typeInfoGen: TypeInfoGen): S {
  assertIsFunction(objFn, "objFn")

  return lateTypeChecker(() => {
    const objectSchema: Record<string, TypeChecker | LateTypeChecker> = objFn()
    assertIsObject(objectSchema, "objectSchema")

    const schemaEntries = Object.entries(objectSchema)
    const cachedPropCheckResults = new WeakMap<object, Map<string, TypeCheckError | null>>()

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) => {
      const propsMsg: string[] = []
      for (const [k, unresolvedTc] of schemaEntries) {
        const tc = resolveTypeChecker(unresolvedTc)
        let propTypename = "..."
        if (!recursiveTypeCheckers.includes(tc)) {
          propTypename = tc.getTypeName(...recursiveTypeCheckers, tc)
        }
        propsMsg.push(`${k}: ${propTypename};`)
      }

      return `{ ${propsMsg.join(" ")} }`
    }

    const applySnapshotProcessor = (obj: Record<string, unknown>, mode: "from" | "to") => {
      const newObj: typeof obj = {}

      // note: we allow excess properties when checking objects
      const keys = Object.keys(obj)
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]
        const unresolvedTc = objectSchema[k]
        if (unresolvedTc) {
          const tc = resolveTypeChecker(unresolvedTc)
          newObj[k] = withErrorPathSegment(k, () =>
            mode === "from" ? tc.fromSnapshotProcessor(obj[k]) : tc.toSnapshotProcessor(obj[k])
          )
        } else {
          // unknown prop, copy as is
          newObj[k] = obj[k]
        }
      }

      return newObj
    }

    const checkObjectType = (obj: any, path: Path, typeCheckedValue: any) => {
      if (!isObject(obj) || (frozen && !(obj instanceof Frozen))) {
        return new TypeCheckError({
          path,
          expectedTypeName: getTypeName(thisTc),
          actualValue: obj,
          typeCheckedValue,
        })
      }

      return null
    }

    const checkObjectProps = (
      obj: any,
      path: Path,
      typeCheckedValue: any,
      typeCheckScope: TypeCheckScope
    ) => {
      const getOrCreateCachedPropCheckResults = (
        cacheObj: object
      ): Map<string, TypeCheckError | null> => {
        let cache = cachedPropCheckResults.get(cacheObj)
        if (!cache) {
          cache = new Map<string, TypeCheckError | null>()
          cachedPropCheckResults.set(cacheObj, cache)
          thisTc.registerExternalCachedResult(cacheObj)
        }
        return cache
      }

      const isPropCacheableObject = isTweakedObject(obj, true)
      let propCheckResultsByName: Map<string, TypeCheckError | null> | undefined

      const checkProp = (k: string, unresolvedTc: TypeChecker | LateTypeChecker) => {
        const childCheckScope = getChildCheckScope(typeCheckScope, k)
        if (childCheckScope === null) {
          return null
        }

        const canUsePropCache = isPropCacheableObject && isTypeCheckScopeAll(childCheckScope)

        if (canUsePropCache && !propCheckResultsByName) {
          propCheckResultsByName = getOrCreateCachedPropCheckResults(obj)
        }

        let valueError: TypeCheckError | null | undefined
        if (canUsePropCache && propCheckResultsByName!.has(k)) {
          valueError = propCheckResultsByName!.get(k)!
        } else {
          const tc = resolveTypeChecker(unresolvedTc)
          valueError = tc.check(obj[k], [...path, k], typeCheckedValue, childCheckScope)
          if (canUsePropCache) {
            propCheckResultsByName!.set(k, valueError)
          }
        }

        if (valueError) {
          return valueError
        }

        return null
      }

      const checkPropByPathElement = (pathElement: unknown): TypeCheckError | null => {
        if (typeof pathElement !== "string") {
          throw failure("assertion error: object path element must be a string")
        }

        const unresolvedTc = objectSchema[pathElement]
        if (!unresolvedTc) {
          return null
        }

        return checkProp(pathElement, unresolvedTc)
      }

      if (isTypeCheckScopeAll(typeCheckScope)) {
        // note: we allow excess properties when checking objects
        for (const [k, unresolvedTc] of schemaEntries) {
          const valueError = checkProp(k, unresolvedTc)
          if (valueError) {
            return valueError
          }
        }

        return null
      }

      if (typeCheckScope.pathToChangedObj.length > typeCheckScope.pathOffset) {
        return checkPropByPathElement(typeCheckScope.pathToChangedObj[typeCheckScope.pathOffset])
      }

      for (const touchedChild of typeCheckScope.touchedChildren) {
        const valueError = checkPropByPathElement(touchedChild)
        if (valueError) {
          return valueError
        }
      }

      return null
    }

    const thisTc: TypeChecker = new TypeChecker(
      TypeCheckerBaseType.Object,

      (obj, path, typeCheckedValue, typeCheckScope) => {
        const objectTypeError = checkObjectType(obj, path, typeCheckedValue)
        if (objectTypeError) {
          return objectTypeError
        }

        return checkObjectProps(obj, path, typeCheckedValue, typeCheckScope)
      },

      (obj, touchedChildren) => {
        if (touchedChildren === "all") {
          cachedPropCheckResults.delete(obj)
          return
        }

        const propCheckResultsByName = cachedPropCheckResults.get(obj)
        if (!propCheckResultsByName) {
          return
        }

        if (touchedChildren.size <= 0) {
          throw failure("assertion error: touchedChildren must not be empty")
        }
        for (const keyOrIndex of touchedChildren) {
          if (typeof keyOrIndex === "string") {
            propCheckResultsByName.delete(keyOrIndex)
          }
        }

        if (propCheckResultsByName.size <= 0) {
          cachedPropCheckResults.delete(obj)
        }
      },

      getTypeName,
      typeInfoGen,

      (obj) => {
        if (!isObject(obj)) {
          return null
        }

        // note: we allow excess properties when checking objects
        for (const [k, unresolvedTc] of schemaEntries) {
          const tc = resolveTypeChecker(unresolvedTc)
          const objVal = obj[k]

          const valueActualChecker = tc.snapshotType(objVal)
          if (!valueActualChecker) {
            return null
          }
        }

        return thisTc
      },

      (obj: Record<string, unknown>) => {
        return applySnapshotProcessor(obj, "from")
      },

      (obj: Record<string, unknown>) => {
        return applySnapshotProcessor(obj, "to")
      }
    )

    return thisTc
  }, typeInfoGen) as any
}

/**
 * A type that represents a plain object.
 * Note that the parameter must be a function that returns an object. This is done so objects can support self / cross types.
 *
 * Example:
 * ```ts
 * // notice the ({ ... }), not just { ... }
 * const pointType = types.object(() => ({
 *   x: types.number,
 *   y: types.number
 * }))
 * ```
 *
 * @template T Type.
 * @param objectFunction Function that generates an object with types.
 * @returns
 */
export function typesObject<T>(objectFunction: T): T {
  // we can't type this function or else we won't be able to make it work recursively
  const typeInfoGen: TypeInfoGen = (t) => new ObjectTypeInfo(t, objectFunction as any)

  return typesObjectHelper(objectFunction, false, typeInfoGen) as any
}

/**
 * `types.object` type info for an object props.
 */
export interface ObjectTypeInfoProps {
  readonly [propName: string]: Readonly<{
    type: AnyStandardType
    typeInfo: TypeInfo
  }>
}

/**
 * `types.object` type info.
 */
export class ObjectTypeInfo extends TypeInfo {
  readonly kind = "object"

  // memoize to always return the same object
  private _props = lazy(() => {
    const objSchema = this._objTypeFn()

    const propTypes: O.Writable<ObjectTypeInfoProps> = {}
    Object.keys(objSchema).forEach((propName) => {
      const type = resolveStandardType(objSchema[propName])
      propTypes[propName] = { type, typeInfo: getTypeInfo(type) }
    })
    return propTypes
  })

  get props(): ObjectTypeInfoProps {
    return this._props()
  }

  override isTopLevelPropertyContainer(): boolean {
    return true
  }

  override getTopLevelPropertyTypeInfo(propertyName: string): TypeInfo | undefined {
    return this.props[propertyName]?.typeInfo
  }

  override findChildTypeInfo(
    predicate: (childTypeInfo: TypeInfo) => boolean
  ): TypeInfo | undefined {
    const props = this.props
    const propNames = Object.keys(props)
    for (let i = 0; i < propNames.length; i++) {
      const childTypeInfo = props[propNames[i]].typeInfo
      if (predicate(childTypeInfo)) {
        return childTypeInfo
      }
    }
    return undefined
  }

  constructor(
    thisType: AnyStandardType,
    private _objTypeFn: ObjectTypeFunction
  ) {
    super(thisType)
  }
}

/**
 * A type that represents frozen data.
 *
 * Example:
 * ```ts
 * const frozenNumberType = types.frozen(types.number)
 * const frozenAnyType = types.frozen(types.unchecked<any>())
 * const frozenNumberArrayType = types.frozen(types.array(types.number))
 * const frozenUncheckedNumberArrayType = types.frozen(types.unchecked<number[]>())
 * ```
 *
 * @template T Type.
 * @param dataType Type of the frozen data.
 * @returns
 */
export function typesFrozen<T extends AnyType>(dataType: T): ModelType<Frozen<TypeToData<T>>> {
  return typesObjectHelper(
    () => ({
      data: dataType,
    }),
    true,
    (t) => new FrozenTypeInfo(t, resolveStandardType(dataType))
  ) as any
}

/**
 * `types.frozen` type info.
 */
export class FrozenTypeInfo extends TypeInfo {
  readonly kind = "frozen"

  get dataTypeInfo(): TypeInfo {
    return getTypeInfo(this.dataType)
  }

  override findChildTypeInfo(predicate: (childTypeInfo: TypeInfo) => boolean): TypeInfo | undefined {
    return predicate(this.dataTypeInfo) ? this.dataTypeInfo : undefined
  }

  constructor(
    thisType: AnyStandardType,
    readonly dataType: AnyStandardType
  ) {
    super(thisType)
  }
}
