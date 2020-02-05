import { computed, IComputedValue } from "mobx"

/**
 * A prop transform.
 */
export interface PropTransform<TProp, TData> {
  /**
   * Transform from property value to custom data.
   *
   * @param prop
   * @returns
   */
  propToData(prop: TProp): TData

  /**
   * Transform from cutom data to property value.
   *
   * @param data
   * @returns
   */
  dataToProp(data: TData): TProp
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
 * const asDate = propTransform({
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
): PropTransformDecorator<TProp> & PropTransform<TProp, TData> {
  const parametrizedDecorator: PropTransformDecorator<TProp> = boundPropName => {
    const decorator = (target: object, propertyKey: string) => {
      // hidden computed getter
      let computedFn: IComputedValue<TData>

      // make the field a getter setter
      Object.defineProperty(target, propertyKey, {
        get(this: any): TData {
          if (!computedFn) {
            computedFn = computed(() => {
              return transform.propToData(this.$[boundPropName])
            })
          }
          return computedFn.get()
        },
        set(this: any, value: any) {
          this.$[boundPropName] = transform.dataToProp(value)
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
