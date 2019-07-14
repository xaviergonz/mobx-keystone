import { AnyModel } from "../model/Model"
import { Ref } from "../ref/Ref"
import { typesTypedModel } from "./model"

/**
 * A type that represents a reference to a model.
 *
 * @typeparam M Model type.
 * @returns
 */
export function typesRef<M extends AnyModel>() {
  return typesTypedModel<Ref<M>>(Ref)
}
