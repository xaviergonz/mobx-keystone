import {
  action,
  IArrayChange,
  IArraySplice,
  intercept,
  IObservableArray,
  ISetWillChange,
  isObservableArray,
  observable,
  ObservableSet,
  observe,
} from "mobx"
import { MaybeOptionalModelProp, OnlyPrimitives, OptionalModelProp, prop } from "../model/prop"
import { AnyType, TypeToData } from "../typeChecking/schemas"
import { tProp } from "../typeChecking/tProp"
import { failure, inDevMode, isArray, isSet } from "../utils"
import { Lock } from "../utils/lock"
import { PropTransform, transformedProp } from "./propTransform"

const observableSetBackedByObservableArray = action(
  <T>(array: IObservableArray<T>): ObservableSet<T> => {
    if (inDevMode()) {
      if (!isObservableArray(array)) {
        throw failure("assertion failed: expected an observable array")
      }
    }

    const set = observable.set(array)

    if (set.size !== array.length) {
      throw failure("arrays backing a set cannot contain duplicate values")
    }

    const mutationLock = new Lock()

    // for speed reasons we will just assume distinct values are only once in the array

    // when the array changes the set changes
    observe(
      array,
      action(
        mutationLock.unlockedFn((change: IArrayChange<T> | IArraySplice<T>) => {
          switch (change.type) {
            case "splice": {
              {
                const removed = change.removed
                for (let i = 0; i < removed.length; i++) {
                  set.delete(removed[i])
                }
              }

              {
                const added = change.added
                for (let i = 0; i < added.length; i++) {
                  set.add(added[i])
                }
              }

              break
            }

            case "update": {
              set.delete(change.oldValue)
              set.add(change.newValue)
              break
            }
          }
        })
      )
    )

    // when the set changes also change the array
    intercept(
      set,
      action((change: ISetWillChange<T>) => {
        if (!mutationLock.isLocked) {
          return null // already changed
        }

        switch (change.type) {
          case "add": {
            array.push(change.newValue)
            break
          }

          case "delete": {
            const i = array.indexOf(change.oldValue)
            if (i >= 0) {
              array.splice(i, 1)
            }
            break
          }
        }

        return change
      })
    )

    return set
  }
)

const arrayAsSetInnerTransform: PropTransform<any[] | unknown, Set<any> | unknown> = {
  propToData(arr) {
    return isArray(arr) ? observableSetBackedByObservableArray(arr as IObservableArray) : arr
  },
  dataToProp(newSet) {
    return isSet(newSet) ? [...newSet.values()] : newSet
  },
}

/**
 * Transforms sets into arrays.
 */
export type TransformSetToArray<T> =
  | (T extends Set<infer I> ? Array<I> : never)
  | Exclude<T, Set<any>>

/**
 * Transforms arrays into sets.
 */
export type TransformArrayToSet<T> =
  | (T extends Array<infer I> ? Set<I> : never)
  | Exclude<T, Array<any>>

export function prop_setArray<TValue>(): MaybeOptionalModelProp<TransformSetToArray<TValue>, TValue>

export function prop_setArray<TValue>(
  defaultFn: () => TValue
): OptionalModelProp<TransformSetToArray<TValue>, TValue>

export function prop_setArray<TValue>(
  defaultValue: OnlyPrimitives<TValue>
): OptionalModelProp<TransformSetToArray<TValue>, TValue>

export function prop_setArray(def?: any) {
  return transformedProp(prop(def), arrayAsSetInnerTransform, true)
}

export function tProp_setArray<TType extends AnyType>(
  type: TType
): MaybeOptionalModelProp<TypeToData<TType>, TransformArrayToSet<TypeToData<TType>>>

export function tProp_setArray<TType extends AnyType>(
  type: TType,
  defaultFn: () => TransformArrayToSet<TypeToData<TType>>
): OptionalModelProp<TypeToData<TType>, TransformArrayToSet<TypeToData<TType>>>

export function tProp_setArray<TType extends AnyType>(
  type: TType,
  defaultValue: OnlyPrimitives<TransformArrayToSet<TypeToData<TType>>>
): OptionalModelProp<TypeToData<TType>, TransformArrayToSet<TypeToData<TType>>>

export function tProp_setArray(typeOrDefaultValue: any, def?: any) {
  return transformedProp(tProp(typeOrDefaultValue, def), arrayAsSetInnerTransform, true)
}
