import { ModelProp } from "../model/prop"
import { propTransform, transformedProp } from "./propTransform"

/**
 * @deprecated Consider using `transformTimestampAsDate` instead.
 *
 * Decorator property transform for number timestamps to Date objects and vice-versa.
 */
export const timestampAsDate = propTransform<number | null | undefined, Date | null | undefined>({
  propToData(prop) {
    if (prop == null) return prop
    return new Date(prop)
  },
  dataToProp(date) {
    if (date == null) return date
    return +date
  },
})

/**
 * Implicit property transform for number timestamps to Date objects and vice-versa.
 *
 * @param prop
 */
export function transformTimestampAsDate<TValue, TCreationValue, TIsOptional>(
  prop: ModelProp<TValue, TCreationValue, TIsOptional, any>
): ModelProp<
  TValue,
  TCreationValue,
  TIsOptional,
  (TValue extends number ? Date : never) | Extract<TValue, undefined | null>,
  (TCreationValue extends number ? Date : never) | Extract<TCreationValue, undefined | null>
> {
  return transformedProp(prop, timestampAsDate)
}
