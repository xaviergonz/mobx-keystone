import {
  action,
  IMapWillChange,
  intercept,
  IObjectDidChange,
  IObservableArray,
  isObservableArray,
  isObservableObject,
  observable,
  ObservableMap,
  observe,
  remove,
  set,
} from "mobx"
import {
  assertIsMap,
  assertIsObservableArray,
  assertIsObservableObject,
  failure,
  inDevMode,
  isArray,
} from "../utils"
import { Lock } from "../utils/lock"
import { tag } from "../utils/tag"

const observableMapBackedByObservableObject = action(<T>(obj: object): ObservableMap<string, T> & {
  dataObject: typeof obj
} => {
  if (inDevMode()) {
    if (!isObservableObject(obj)) {
      throw failure("assertion failed: expected an observable object")
    }
  }

  const map = observable.map()
  ;(map as any).dataObject = obj

  const keys = Object.keys(obj)
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    map.set(k, (obj as any)[k])
  }

  const mutationLock = new Lock()

  // when the object changes the map changes
  observe(
    obj,
    action(
      mutationLock.unlockedFn((change: IObjectDidChange) => {
        switch (change.type) {
          case "add":
          case "update": {
            map.set(change.name, change.newValue)
            break
          }

          case "remove": {
            map.delete(change.name)
            break
          }
        }
      })
    )
  )

  // when the map changes also change the object
  intercept(
    map,
    action((change: IMapWillChange<string, T>) => {
      if (!mutationLock.isLocked) {
        return null // already changed
      }

      switch (change.type) {
        case "add":
        case "update": {
          set(obj, change.name, change.newValue)
          break
        }

        case "delete": {
          remove(obj, change.name)
          break
        }
      }

      return change
    })
  )

  return map as any
})

const observableMapBackedByObservableArray = action(
  <T>(
    array: IObservableArray<[string, T]>
  ): ObservableMap<string, T> & { dataObject: typeof array } => {
    if (inDevMode()) {
      if (!isObservableArray(array)) {
        throw failure("assertion failed: expected an observable array")
      }
    }

    const map = observable.map(array)
    ;(map as any).dataObject = array

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
        mutationLock.unlockedFn((change: any /*IArrayDidChange<[string, T]>*/) => {
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
            const i = array.findIndex((i) => i[0] === change.name)
            array[i] = [change.name, change.newValue!]
            break
          }

          case "add": {
            array.push([change.name, change.newValue!])
            break
          }

          case "delete": {
            const i = array.findIndex((i) => i[0] === change.name)
            if (i >= 0) {
              array.splice(i, 1)
            }
            break
          }
        }

        return change
      })
    )

    return map as any
  }
)

const asMapTag = tag((objOrArray: Record<string, any> | Array<[string, any]>) => {
  if (isArray(objOrArray)) {
    assertIsObservableArray(objOrArray, "objOrArray")
    return observableMapBackedByObservableArray(objOrArray)
  } else {
    assertIsObservableObject(objOrArray, "objOrArray")
    return observableMapBackedByObservableObject(objOrArray)
  }
})

/**
 * Wraps an observable object or a tuple array to offer a map like interface.
 *
 * @param array Array.
 */
export function asMap<T>(
  array: Array<[string, T]>
): ObservableMap<string, T> & { dataObject: Array<[string, T]> }

/**
 * Wraps an observable object or a tuple array to offer a map like interface.
 *
 * @param object Object.
 */
export function asMap<T>(
  object: Record<string, T>
): ObservableMap<string, T> & { dataObject: Record<string, T> }

/**
 * Wraps an observable object or a tuple array to offer a map like interface.
 *
 * @param objOrArray Object or array.
 */
export function asMap<T>(
  objOrArray: Record<string, T> | Array<[string, T]>
): ObservableMap<string, T> & { dataObject: typeof objOrArray } {
  return asMapTag.for(objOrArray) as any
}

/**
 * Converts a map to an object. If the map is a collection wrapper it will return the backed object.
 *
 * @param map
 */
export function mapToObject<T>(map: Map<string, T>): Record<string, T> {
  assertIsMap(map, "map")

  const dataObject = (map as any).dataObject
  if (dataObject && !isArray(dataObject)) {
    return dataObject
  }

  const obj: Record<string, T> = {}
  for (const k of map.keys()) {
    obj[k] = map.get(k)!
  }

  return obj
}

/**
 * Converts a map to an array. If the map is a collection wrapper it will return the backed array.
 *
 * @param map
 */
export function mapToArray<T>(map: Map<string, T>): Array<[string, T]> {
  assertIsMap(map, "map")

  const dataObject = (map as any).dataObject
  if (dataObject && isArray(dataObject)) {
    return dataObject
  }

  const arr: [string, any][] = []
  for (const k of map.keys()) {
    arr.push([k, map.get(k)])
  }

  return arr
}
