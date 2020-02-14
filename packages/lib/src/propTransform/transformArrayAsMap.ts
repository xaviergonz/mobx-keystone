import {
  action,
  IArrayChange,
  IArraySplice,
  IMapWillChange,
  intercept,
  IObservableArray,
  isObservableArray,
  observable,
  ObservableMap,
  observe,
} from "mobx"
import { MaybeOptionalModelProp, OnlyPrimitives, OptionalModelProp, prop } from "../model/prop"
import { AnyType, TypeToData } from "../typeChecking/schemas"
import { tProp } from "../typeChecking/tProp"
import { failure, inDevMode, isArray, isMap } from "../utils"
import { Lock } from "../utils/lock"
import { PropTransform, transformedProp } from "./propTransform"

const observableMapBackedByObservableArray = action(
  <T>(array: IObservableArray<[string, T]>): ObservableMap<string, T> => {
    if (inDevMode()) {
      if (!isObservableArray(array)) {
        throw failure("assertion failed: expected an observable array")
      }
    }

    const map = observable.map(array)

    if (map.size !== array.length) {
      throw failure("arrays backing a map cannot contain duplicate keys")
    }

    const mutationLock = new Lock()

    // for speed reasons we will just assume distinct values are only once in the array
    // also we assume tuples themselves are immutable

    // when the array changes the map changes
    observe(
      array,
      action(
        mutationLock.unlockedFn((change: IArrayChange<[string, T]> | IArraySplice<[string, T]>) => {
          switch (change.type) {
            case "splice": {
              {
                const removed = change.removed
                for (let i = 0; i < removed.length; i++) {
                  map.delete(removed[i][0])
                }
              }

              {
                const added = change.added
                for (let i = 0; i < added.length; i++) {
                  map.set(added[i][0], added[i][1])
                }
              }

              break
            }

            case "update": {
              map.delete(change.oldValue[0])
              map.set(change.newValue[0], change.newValue[1])
              break
            }
          }
        })
      )
    )

    // when the map changes also change the array
    intercept(
      map,
      action((change: IMapWillChange<string, T>) => {
        if (!mutationLock.isLocked) {
          return null // already changed
        }

        switch (change.type) {
          case "update": {
            // replace the whole tuple to keep tuple immutability
            const i = array.findIndex(i => i[0] === change.name)
            array[i] = [change.name, change.newValue!]
            break
          }

          case "add": {
            array.push([change.name, change.newValue!])
            break
          }

          case "delete": {
            const i = array.findIndex(i => i[0] === change.name)
            if (i >= 0) {
              array.splice(i, 1)
            }
            break
          }
        }

        return change
      })
    )

    return map
  }
)

const arrayAsMapInnerTransform: PropTransform<
  [string, any][] | unknown,
  Map<string, any> | unknown
> = {
  propToData(arr) {
    return isArray(arr) ? observableMapBackedByObservableArray(arr as IObservableArray) : arr
  },
  dataToProp(newMap) {
    if (!isMap(newMap)) {
      return newMap
    }

    const arr: [string, any][] = []
    for (const k of newMap.keys()) {
      arr.push([k, newMap.get(k)])
    }

    return arr
  },
}

/**
 * Transforms maps into arrays.
 */
export type TransformMapToArray<T> =
  | (T extends Map<string, infer I> ? [string, I][] : never)
  | Exclude<T, Map<string, any>>

/**
 * Transforms arrays into maps.
 */
export type TransformArrayToMap<T> =
  | (T extends [string, infer I][] ? Map<string, I> : never)
  | Exclude<T, [string, any][]>

export function prop_mapArray<TValue>(): MaybeOptionalModelProp<TransformMapToArray<TValue>, TValue>

export function prop_mapArray<TValue>(
  defaultFn: () => TValue
): OptionalModelProp<TransformMapToArray<TValue>, TValue>

export function prop_mapArray<TValue>(
  defaultValue: OnlyPrimitives<TValue>
): OptionalModelProp<TransformMapToArray<TValue>, TValue>

export function prop_mapArray(def?: any) {
  return transformedProp(prop(def), arrayAsMapInnerTransform, true)
}

export function tProp_mapArray<TType extends AnyType>(
  type: TType
): MaybeOptionalModelProp<TypeToData<TType>, TransformArrayToMap<TypeToData<TType>>>

export function tProp_mapArray<TType extends AnyType>(
  type: TType,
  defaultFn: () => TransformArrayToMap<TypeToData<TType>>
): OptionalModelProp<TypeToData<TType>, TransformArrayToMap<TypeToData<TType>>>

export function tProp_mapArray<TType extends AnyType>(
  type: TType,
  defaultValue: OnlyPrimitives<TransformArrayToMap<TypeToData<TType>>>
): OptionalModelProp<TypeToData<TType>, TransformArrayToMap<TypeToData<TType>>>

export function tProp_mapArray(typeOrDefaultValue: any, def?: any) {
  return transformedProp(tProp(typeOrDefaultValue, def), arrayAsMapInnerTransform, true)
}
