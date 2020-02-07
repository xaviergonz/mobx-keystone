import { ModelProp } from "../model/prop"
import { propTransform, transformedProp } from "./propTransform"

/**
 * @deprecated Consider using `transformStringAsDate` instead.
 *
 * Decorator property transform for ISO date strings to Date objects and vice-versa.
 */
export const stringAsDate = propTransform<string | null | undefined, Date | null | undefined>({
  propToData(prop) {
    if (prop == null) return prop
    return new Date(prop)
  },
  dataToProp(date) {
    if (date == null) return date
    return date.toJSON()
  },
})

/**
 * Implicit property transform for ISO date strings to Date objects and vice-versa.
 *
 * @param prop
 */
export function transformStringAsDate<TValue, TCreationValue, TIsOptional>(
  prop: ModelProp<TValue, TCreationValue, TIsOptional, any>
): ModelProp<
  TValue,
  TCreationValue,
  TIsOptional,
  (TValue extends string ? Date : never) | Extract<TValue, undefined | null>,
  (TCreationValue extends string ? Date : never) | Extract<TCreationValue, undefined | null>
> {
  return transformedProp(prop, stringAsDate)
}
