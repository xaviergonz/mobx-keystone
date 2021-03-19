import type { AnyDataModel } from "../dataModel/BaseDataModel"
import type { AnyModel } from "../model/BaseModel"
import { AnyModelProp, noDefaultValue } from "../modelShared/prop"
import { failure } from "../utils"

/**
 * A prop transform.
 */
export interface PropTransform<TProp, TData> {
  /**
   * Transform from property value to custom data.
   *
   * @param propValue
   * @param setProp
   * @returns
   */
  propToData(propValue: TProp, setProp?: (newPropValue: TProp) => void): TData

  /**
   * Transform from custom data to property value.
   * You might throw here to make the property read-only.
   *
   * @param dataValue
   * @returns
   */
  dataToProp(dataValue: TData): TProp
}
class MemoTransformCache {
  private readonly cache = new WeakMap<object, Map<string, MemoPropTransform<any, any>>>()

  getOrCreateMemoTransform<TProp, TData>(
    target: AnyModel | AnyDataModel,
    propName: string,
    baseTransform: PropTransform<TProp, TData>
  ): MemoPropTransform<TProp, TData> {
    let transformsPerProperty = this.cache.get(target)
    if (!transformsPerProperty) {
      transformsPerProperty = new Map()
      this.cache.set(target, transformsPerProperty)
    }
    let memoTransform = transformsPerProperty.get(propName)
    if (!memoTransform) {
      memoTransform = toMemoPropTransform(baseTransform, (newPropValue) => {
        target.$[propName] = newPropValue
      })
      transformsPerProperty.set(propName, memoTransform)
    }
    return memoTransform
  }
}

/**
 * @ignore
 * @internal
 */
export const memoTransformCache = new MemoTransformCache()

/**
 * @ignore
 * @internal
 */
export interface MemoPropTransform<TProp, TData> {
  isMemoPropTransform: true

  propToData(propValue: TProp): TData
  dataToProp(dataValue: TData): TProp
}

const valueNotMemoized = Symbol("valueNotMemoized")

function toMemoPropTransform<TProp, TData>(
  transform: PropTransform<TProp, TData>,
  propSetter: (newPropValue: TProp) => void
): MemoPropTransform<TProp, TData> {
  let lastPropValue: any = valueNotMemoized
  let lastDataValue: any = valueNotMemoized

  return {
    isMemoPropTransform: true,

    propToData(propValue: any) {
      if (lastPropValue !== propValue) {
        lastDataValue = transform.propToData(propValue, propSetter)
        lastPropValue = propValue
      }
      return lastDataValue
    },
    dataToProp(newDataValue: any) {
      // clear caches in this case
      lastPropValue = valueNotMemoized
      lastDataValue = valueNotMemoized

      return transform.dataToProp(newDataValue)
    },
  }
}

/**
 * @ignore
 * @internal
 */
export function transformedProp(
  prop: AnyModelProp,
  transform: PropTransform<any, any>,
  transformDefault: boolean
): AnyModelProp {
  if (prop.transform) {
    throw failure("a property cannot have more than one transform")
  }

  const p = {
    ...prop,
    transform,
  }

  // transform defaults if needed
  if (transformDefault) {
    if (p.defaultValue !== noDefaultValue) {
      const originalDefaultValue = p.defaultValue
      p.defaultValue = transform.dataToProp(originalDefaultValue)
    }
    if (p.defaultFn !== noDefaultValue) {
      const originalDefaultFn = p.defaultFn as () => any
      p.defaultFn = () => transform.dataToProp(originalDefaultFn())
    }
  }

  return p
}
