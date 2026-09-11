import {
  action,
  type IObservableArray,
  type ISetWillChange,
  intercept,
  isObservableArray,
  type ObservableSet,
  observable,
  observe,
  runInAction,
  transaction,
  untracked,
} from "mobx"
import {
  assertIsObservableArray,
  assertIsSet,
  failure,
  getMobxVersion,
  inDevMode,
  isEqualOrBothNaN,
} from "../utils"
import { tag } from "../utils/tag"

const observableSetBackedByObservableArray = <T>(
  array: IObservableArray<T>
): ObservableSet<T> & { dataObject: typeof array } => {
  if (inDevMode) {
    if (!isObservableArray(array)) {
      throw failure("assertion failed: expected an observable array")
    }
  }

  const set = transaction(() =>
    untracked(() => {
      if (getMobxVersion() >= 6) {
        return observable.set(array, { deep: false })
      } else {
        const set = observable.set<T>(undefined, { deep: false })
        runInAction(() => {
          array.forEach((item) => {
            set.add(item)
          })
        })
        return set
      }
    })
  )
  ;(set as ObservableSet<T> & { dataObject: typeof array }).dataObject = array

  if (set.size !== array.length) {
    throw failure("arrays backing a set cannot contain duplicate values")
  }

  let setAlreadyChanged = false
  let arrayAlreadyChanged = false

  // for speed reasons we will just assume distinct values are only once in the array

  // when the array changes the set changes
  observe(
    array,
    action((change: any /*IArrayDidChange<T>*/) => {
      if (setAlreadyChanged) {
        return
      }

      arrayAlreadyChanged = true

      try {
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

          default:
            throw failure("assertion error: unsupported array change type")
        }
      } finally {
        arrayAlreadyChanged = false
      }
    })
  )

  // when the set changes also change the array
  intercept(
    set,
    action((change: ISetWillChange<T>) => {
      if (arrayAlreadyChanged) {
        return change
      }

      if (setAlreadyChanged) {
        return null
      }

      setAlreadyChanged = true

      try {
        switch (change.type) {
          case "add": {
            if (!set.has(change.newValue)) {
              array.push(change.newValue)
              const storedValue = array[array.length - 1]
              if (getMobxVersion() >= 6) {
                change.newValue = storedValue
              } else if (!isEqualOrBothNaN(storedValue, change.newValue)) {
                // MobX 4/5 ignore replacement values returned by set interceptors.
                arrayAlreadyChanged = true
                try {
                  set.add(storedValue)
                } finally {
                  arrayAlreadyChanged = false
                }
                return null
              }
            }
            break
          }

          case "delete": {
            const i = Number.isNaN(change.oldValue)
              ? array.findIndex(Number.isNaN)
              : array.indexOf(change.oldValue)
            if (i >= 0) {
              array.splice(i, 1)
            }
            break
          }

          default:
            throw failure("assertion error: unsupported set change type")
        }

        return change
      } finally {
        setAlreadyChanged = false
      }
    })
  )

  return set as ObservableSet<T> & { dataObject: typeof array }
}

const asSetTag = tag((array: Array<unknown>) => {
  assertIsObservableArray(array, "array")
  return observableSetBackedByObservableArray(array)
})

/**
 * Wraps an observable array to offer a set like interface.
 *
 * @param array
 */
export function asSet<T>(array: Array<T>): ObservableSet<T> & { dataObject: typeof array } {
  return asSetTag.for(array)
}

/**
 * Converts a set to an array. If the set is a collection wrapper it will return the backed array.
 *
 * @param set
 */
export function setToArray<T>(set: Set<T> | ObservableSet<T>): Array<T> {
  assertIsSet(set, "set")

  const dataObject = (set as Set<T> & { dataObject: Array<T> }).dataObject
  if (dataObject) {
    return dataObject
  }

  return Array.from(set.values())
}
