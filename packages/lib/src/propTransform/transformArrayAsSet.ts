import { ModelProp } from "../model/prop"
import { arrayAsSet } from "../wrappers/arrayAsSet"
import { propTransform, transformedProp } from "./propTransform"

const arrayAsSetInnerTransform = propTransform<
  any[] | null | undefined,
  Set<any> | null | undefined
>({
  propToData(arr) {
    return arr ? arrayAsSet(() => arr) : arr
  },
  dataToProp(newSet) {
    return newSet ? [...newSet.values()] : newSet
  },
})

/**
 * Implicit property transform for that allows a backed array to be used as if it were a set.
 *
 * @param prop
 */
export function transformArrayAsSet<TValue, TCreationValue, TIsOptional>(
  prop: ModelProp<TValue, TCreationValue, TIsOptional, any>
): ModelProp<
  TValue,
  TCreationValue,
  TIsOptional,
  (TValue extends Array<infer I> ? Set<I> : never) | Extract<TValue, undefined | null>,
  | (TCreationValue extends Array<infer I> ? Set<I> : never)
  | Extract<TCreationValue, undefined | null>
> {
  return transformedProp(prop, arrayAsSetInnerTransform)
}
