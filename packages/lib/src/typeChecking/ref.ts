import { AnyModel } from "../model/Model"
import { Ref } from "../ref/Ref"
import { typesModel } from "./model"

/**
 * A type that represents a reference to a model.
 *
 * Example:
 * ```ts
 * const refToSomeModelType = types.ref<SomeModel>()
 * ```
 *
 * @typeparam M Model type.
 * @returns
 */
export function typesRef<M extends AnyModel>() {
  return typesModel<Ref<M>>(Ref)
}
