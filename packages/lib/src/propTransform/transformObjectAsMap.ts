import {
  action,
  IMapWillChange,
  intercept,
  IObjectDidChange,
  IObservableObject,
  isObservableObject,
  observable,
  ObservableMap,
  observe,
  remove,
  set,
} from "mobx"
import { MaybeOptionalModelProp, OnlyPrimitives, OptionalModelProp, prop } from "../model/prop"
import { AnyType, TypeToData } from "../typeChecking/schemas"
import { tProp } from "../typeChecking/tProp"
import { failure, inDevMode, isMap, isObject } from "../utils"
import { Lock } from "../utils/lock"
import { PropTransform, transformedProp } from "./propTransform"

const observableMapBackedByObservableObject = action(
  <T>(obj: IObservableObject): ObservableMap<string, T> => {
    if (inDevMode()) {
      if (!isObservableObject(obj)) {
        throw failure("assertion failed: expected an observable object")
      }
    }

    const map = observable.map()

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

    return map
  }
)

const objectAsMapInnerTransform: PropTransform<
  Record<string, any> | unknown,
  Map<string, any> | unknown
> = {
  propToData(obj) {
    return isObject(obj) ? observableMapBackedByObservableObject(obj as IObservableObject) : obj
  },
  dataToProp(newMap) {
    if (!isMap(newMap)) {
      return newMap
    }

    const obj: any = {}
    for (const k of newMap.keys()) {
      obj[k] = newMap.get(k)
    }

    return obj
  },
}

/**
 * Transforms maps into objects.
 */
export type TransformMapToObject<T> =
  | (T extends Map<string, infer I> ? Record<string, I> : never)
  | Exclude<T, Map<string, any>>

/**
 * Transforms objects into maps.
 */
export type TransformObjectToMap<T> =
  | (T extends Record<string, infer I> ? Map<string, I> : never)
  | Exclude<T, Record<string, any>>

export function prop_mapObject<TValue>(): MaybeOptionalModelProp<
  TransformMapToObject<TValue>,
  TValue
>

export function prop_mapObject<TValue>(
  defaultFn: () => TValue
): OptionalModelProp<TransformMapToObject<TValue>, TValue>

export function prop_mapObject<TValue>(
  defaultValue: OnlyPrimitives<TValue>
): OptionalModelProp<TransformMapToObject<TValue>, TValue>

export function prop_mapObject(def?: any) {
  return transformedProp(prop(def), objectAsMapInnerTransform, true)
}

export function tProp_mapObject<TType extends AnyType>(
  type: TType
): MaybeOptionalModelProp<TypeToData<TType>, TransformObjectToMap<TypeToData<TType>>>

export function tProp_mapObject<TType extends AnyType>(
  type: TType,
  defaultFn: () => TransformObjectToMap<TypeToData<TType>>
): OptionalModelProp<TypeToData<TType>, TransformObjectToMap<TypeToData<TType>>>

export function tProp_mapObject<TType extends AnyType>(
  type: TType,
  defaultValue: OnlyPrimitives<TransformObjectToMap<TypeToData<TType>>>
): OptionalModelProp<TypeToData<TType>, TransformObjectToMap<TypeToData<TType>>>

export function tProp_mapObject(typeOrDefaultValue: any, def?: any) {
  return transformedProp(tProp(typeOrDefaultValue, def), objectAsMapInnerTransform, true)
}
