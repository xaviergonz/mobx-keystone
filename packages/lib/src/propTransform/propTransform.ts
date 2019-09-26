import { computed, IComputedValue } from "mobx"
import { ActionContextActionType } from "../action/context"
import { wrapInAction } from "../action/wrapInAction"
import { addHiddenProp } from "../utils"

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
export type PropTransformDecorator = <M>(
  boundPropName: keyof M
) => (target: M, propertyKey: string) => void

/**
 * Creates a prop transform, useful to transform property data into another kind of data.
 *
 * For example, to transform from a number timestamp into a date:
 * ```ts
 * const asDate = propTransform({
 *   fromPropToData(prop: number) {
 *     return new Date(prop)
 *   },
 *   fromDataToProp(data: Date) {
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
): PropTransformDecorator {
  return <M>(boundPropName: keyof M) => {
    const decorator = (target: M, propertyKey: string) => {
      // hidden model action for the setter
      const setterName = `$propTransformSet-${propertyKey}`

      function hiddenSetter(this: any, value: any) {
        this.$[boundPropName] = value
      }
      const hiddenSetterAction = wrapInAction(
        setterName,
        hiddenSetter,
        ActionContextActionType.Sync
      )
      addHiddenProp(target, setterName, hiddenSetterAction)

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
          this[setterName](transform.dataToProp(value))
          return true
        },
      })
    }

    return decorator
  }
}
