import { ModelProp, noDefaultValue } from "../model/prop"
import { failure } from "../utils"

/**
 * A prop transform.
 */
export interface PropTransform<TProp, TData> {
  /**
   * Transform from property value to custom data.
   *
   * @param propValue
   * @returns
   */
  propToData(propValue: TProp): TData

  /**
   * Transform from custom data to property value.
   * You might throw here to make the property read-only.
   *
   * @param dataValue
   * @returns
   */
  dataToProp(dataValue: TData): TProp
}

/**
 * A prop transform decorator.
 */
export type PropTransformDecorator<TProp> = <PK extends string>(
  boundPropName: PK
) => (target: { [k in PK]: TProp }, propertyKey: string) => void

/**
 * Creates a prop transform, useful to transform property data into another kind of data.
 *
 * For example, to transform from a number timestamp into a date:
 * ```ts
 * const asDate = propTransformDecorator({
 *   propToData(prop: number) {
 *     return new Date(prop)
 *   },
 *   dataToProp(data: Date) {
 *     return +data
 *   }
 * })
 *
 * @model("myApp/MyModel")
 * class MyModel extends Model({
 *   timestamp: prop<number>()
 * }) {
 *   @asDate("timestamp")
 *   date!: Date
 * }
 *
 * const date: Date = myModel.date
 * // inside some model action
 * myModel.date = new Date()
 * ```
 *
 * @typename TProp Property value type.
 * @typename TData Data value type.
 * @param transform Transform to apply.
 * @returns A decorator that can be used to decorate model class fields.
 */
export function propTransform<TProp, TData>(
  transform: PropTransform<TProp, TData>
): PropTransformDecorator<TProp> & typeof transform {
  const parametrizedDecorator: PropTransformDecorator<TProp> = boundPropName => {
    const decorator = (target: object, propertyKey: string) => {
      // make the field a getter setter
      Object.defineProperty(target, propertyKey, {
        get(this: any): TData {
          const memoTransform = memoTransformCache.getOrCreateMemoTransform(
            this,
            propertyKey,
            transform
          )

          return memoTransform.propToData(this.$[boundPropName])
        },
        set(this: any, value: any) {
          const memoTransform = memoTransformCache.getOrCreateMemoTransform(
            this,
            propertyKey,
            transform
          )

          const oldPropValue = this.$[boundPropName]
          this.$[boundPropName] = memoTransform.dataToProp(value, oldPropValue)
          return true
        },
      })
    }

    return decorator
  }
  ;(parametrizedDecorator as any).propToData = transform.propToData.bind(transform)
  ;(parametrizedDecorator as any).dataToProp = transform.dataToProp.bind(transform)

  return parametrizedDecorator as any
}

class MemoTransformCache {
  private readonly cache = new WeakMap<object, Map<string, MemoPropTransform<any, any>>>()

  getOrCreateMemoTransform<TProp, TData>(
    target: object,
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
      memoTransform = toMemoPropTransform(baseTransform)
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
  dataToProp(newDataValue: TData, currentPropValue: TProp): TProp
}

const valueNotMemoized = Symbol("valueNotMemoized")

function toMemoPropTransform<TProp, TData>(
  transform: PropTransform<TProp, TData>
): MemoPropTransform<TProp, TData> {
  let lastPropValue: any = valueNotMemoized
  let lastDataValue: any = valueNotMemoized

  return {
    isMemoPropTransform: true,

    propToData(propValue: any) {
      if (lastPropValue !== propValue) {
        lastDataValue = transform.propToData(propValue)
        lastPropValue = propValue
      }
      return lastDataValue
    },
    dataToProp(newDataValue: any, oldPropValue: any) {
      // check the last prop value too just in case the backed value changed
      // yet we try to re-set the same data
      if (lastDataValue !== newDataValue || lastPropValue !== oldPropValue) {
        lastPropValue = transform.dataToProp(newDataValue)
        lastDataValue = newDataValue
      }
      return lastPropValue
    },
  }
}

/**
 * @ignore
 * @internal
 */
export function transformedProp(
  prop: ModelProp<any, any, any, any, any>,
  transform: PropTransform<any, any>,
  transformDefault: boolean
): ModelProp<any, any, any, any, any> {
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
