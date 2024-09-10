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
} from "mobx"
import {
  assertIsMap,
  assertIsObservableArray,
  assertIsObservableObject,
  failure,
  getMobxVersion,
  inDevMode,
  isArray,
} from "../utils"
import { setIfDifferent } from "../utils/setIfDifferent"
import { tag } from "../utils/tag"

const observableMapBackedByObservableObject = action(
  <T>(
    obj: object
  ): ObservableMap<string, T> & {
    dataObject: typeof obj
  } => {
    if (inDevMode) {
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

    let mapAlreadyChanged = false
    let objectAlreadyChanged = false

    // when the object changes the map changes
    observe(
      obj,
      action((change: IObjectDidChange) => {
        if (mapAlreadyChanged) {
          return
        }

        objectAlreadyChanged = true

        try {
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
        } finally {
          objectAlreadyChanged = false
        }
      })
    )

    // when the map changes also change the object
    intercept(
      map,
      action((change: IMapWillChange<string, T>) => {
        if (mapAlreadyChanged) {
          return null
        }

        if (objectAlreadyChanged) {
          return change
        }

        mapAlreadyChanged = true

        try {
          switch (change.type) {
            case "add":
            case "update": {
              setIfDifferent(obj, change.name, change.newValue)
              break
            }

            case "delete": {
              remove(obj, change.name)
              break
            }
          }

          return change
        } finally {
          mapAlreadyChanged = false
        }
      })
    )

    return map as any
  }
)

const observableMapBackedByObservableArray = action(
  <T>(
    array: IObservableArray<[string, T]>
  ): ObservableMap<string, T> & { dataObject: typeof array } => {
    if (inDevMode) {
      if (!isObservableArray(array)) {
        throw failure("assertion failed: expected an observable array")
      }
    }

    let map: ObservableMap<string, T>
    if (getMobxVersion() >= 6) {
      map = observable.map(array)
    } else {
      map = observable.map()
      array.forEach(([k, v]) => {
        map.set(k, v)
      })
    }
    ;(map as any).dataObject = array

    if (map.size !== array.length) {
      throw failure("arrays backing a map cannot contain duplicate keys")
    }

    let mapAlreadyChanged = false
    let arrayAlreadyChanged = false

    // for speed reasons we will just assume distinct values are only once in the array
    // also we assume tuples themselves are immutable

    // when the array changes the map changes
    observe(
      array,
      action((change: any /*IArrayDidChange<[string, T]>*/) => {
        if (mapAlreadyChanged) {
          return
        }

        arrayAlreadyChanged = true
        try {
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
        } finally {
          arrayAlreadyChanged = false
        }
      })
    )

    // when the map changes also change the array
    intercept(
      map,
      action((change: IMapWillChange<string, T>) => {
        if (mapAlreadyChanged) {
          return null
        }

        if (arrayAlreadyChanged) {
          return change
        }

        mapAlreadyChanged = true

        try {
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
        } finally {
          mapAlreadyChanged = false
        }
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
export function asMap<K, V>(
  array: Array<[K, V]>
): ObservableMap<K, V> & { dataObject: Array<[K, V]> }

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
export function asMap(
  objOrArray: Record<string, unknown> | Array<[unknown, unknown]>
): ObservableMap<unknown, unknown> & { dataObject: typeof objOrArray } {
  return asMapTag.for(objOrArray) as any
}

/**
 * Converts a map to an object. If the map is a collection wrapper it will return the backed object.
 *
 * @param map
 */
export function mapToObject<T>(map: Pick<Map<string, T>, "forEach">): Record<string, T> {
  assertIsMap(map, "map")

  const dataObject = (map as any).dataObject
  if (dataObject && !isArray(dataObject)) {
    return dataObject
  }

  const obj: Record<string, T> = {}
  map.forEach((v, k) => {
    obj[k] = v
  })

  return obj
}

/**
 * Converts a map to an array. If the map is a collection wrapper it will return the backed array.
 *
 * @param map
 */
export function mapToArray<K, V>(map: Pick<Map<K, V>, "forEach">): Array<[K, V]> {
  assertIsMap(map, "map")

  const dataObject = (map as any).dataObject
  if (dataObject && isArray(dataObject)) {
    return dataObject
  }

  const arr: [K, V][] = []
  map.forEach((v, k) => {
    arr.push([k, v])
  })

  return arr
}
