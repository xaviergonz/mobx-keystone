import { reaction } from "mobx"
import { model } from "../model/modelDecorator"
import { isModel } from "../model/utils"
import { assertIsObject, failure } from "../utils"
import { Ref, RefConstructor } from "./Ref"

/**
 * Reference resolver type.
 */
export type RefResolver<T extends object> = (ref: Ref<T>) => T | undefined

/**
 * Reference ID resolver type.
 */
export type RefIdResolver<T extends object> = (target: T) => string | undefined

/**
 * Reference resolve valude changed hook type.
 */
export type RefOnResolvedValueChange<T extends object> = (
  ref: Ref<T>,
  newValue: T | undefined,
  oldValue: T | undefined
) => void

/**
 * @ignore
 */
export function internalCustomRef<T extends object>(
  modelTypeId: string,
  resolverGen: () => RefResolver<T>,
  getId: RefIdResolver<T>,
  onResolvedValueChange: RefOnResolvedValueChange<T> | undefined
): RefConstructor<T> {
  @model(modelTypeId)
  class CustomRef extends Ref<T> {
    private resolver?: RefResolver<T>

    resolve(): T | undefined {
      if (!this.resolver) {
        this.resolver = resolverGen()
      }

      return this.resolver(this)
    }
  }

  const fn = (target: T) => {
    let id: string | undefined
    if (typeof target === "string") {
      id = target
    } else {
      assertIsObject(target, "target")
      id = getId(target)
    }

    if (typeof id !== "string") {
      throw failure("ref target object must have an id of string type")
    }

    const model = new CustomRef({
      id,
    })

    // listen to changes
    if (onResolvedValueChange) {
      let oldValue = model.maybeCurrent
      // TODO: will not disposing this leak?
      reaction(
        () => model.maybeCurrent,
        newValue => {
          if (newValue !== oldValue) {
            const savedOldValue = oldValue
            oldValue = newValue
            onResolvedValueChange!(model, newValue, savedOldValue)
          }
        },
        {
          fireImmediately: true,
        }
      )
    }

    return model
  }
  fn.refClass = CustomRef

  return (fn as any) as RefConstructor<T>
}

/**
 * Uses a model `getRefId()` method whenever possible to get a reference ID.
 * If the model does not have an implementation of that method it returns `undefined`.
 * If the model has an implementation, but that implementation returns anything other than
 * a `string` it will throw.
 *
 * @param target Target object to get the ID from.
 * @returns The string ID or `undefined`.
 */
export function getModelRefId(target: object): string | undefined {
  if (isModel(target) && target.getRefId) {
    const id = target.getRefId()
    if (typeof id !== "string") {
      throw failure("'getRefId()' must return a string when present")
    }
    return id
  }
  return undefined
}
