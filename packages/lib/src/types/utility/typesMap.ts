import type { ModelPropTransform } from "../../modelShared/prop"
import { isMap } from "../../utils"
import { asMap } from "../../wrappers/asMap"
import { typesArray } from "../arrayBased/typesArray"
import { typesTuple } from "../arrayBased/typesTuple"
import { typesRecord } from "../objectBased/typesRecord"
import type { AnyType, ArrayType, RecordType, TypeToData } from "../schemas"
import { TypeCheckerBaseType } from "../TypeChecker"
import type { CodecFromEncoded, RuntimeAdapter } from "./typesCodecCore"
import { createCodecType, identityRuntimeAdapter } from "./typesCodecCore"
import { resolveCodecSupport } from "./typesCodecSupport"

/**
 * Creates a Map proxy that adapts stored keys/values to runtime keys/values.
 * Shared by object-backed and array-backed map transforms.
 */
function makeMapProxy<TKeyStored, TKeyRuntime, TValueStored, TValueRuntime>(
  storedMap: Map<TKeyStored, TValueStored>,
  keyAdapter: RuntimeAdapter<TKeyStored, TKeyRuntime>,
  valueAdapter: RuntimeAdapter<TValueStored, TValueRuntime>
): Map<TKeyRuntime, TValueRuntime> {
  return new Proxy(storedMap, {
    get(target, prop, receiver) {
      switch (prop) {
        case "get":
          return (key: TKeyRuntime) => {
            const storedKey = keyAdapter.toStored(key)
            if (!target.has(storedKey)) {
              return undefined
            }

            return valueAdapter.toRuntime(
              target.get(storedKey) as TValueStored,
              (newStoredValue) => {
                target.set(storedKey, newStoredValue)
              }
            )
          }
        case "set":
          return (key: TKeyRuntime, value: TValueRuntime) => {
            target.set(keyAdapter.toStored(key), valueAdapter.toStored(value))
            return receiver
          }
        case "has":
          return (key: TKeyRuntime) => target.has(keyAdapter.toStored(key))
        case "delete":
          return (key: TKeyRuntime) => target.delete(keyAdapter.toStored(key))
        case "clear":
          return () => target.clear()
        case "size":
          return target.size
        case "forEach":
          return (
            callback: (
              value: TValueRuntime,
              key: TKeyRuntime,
              map: Map<TKeyRuntime, TValueRuntime>
            ) => void,
            thisArg?: unknown
          ) => {
            target.forEach((value, key) => {
              callback.call(
                thisArg,
                valueAdapter.toRuntime(value, (newStoredValue) => {
                  target.set(key, newStoredValue)
                }),
                keyAdapter.toRuntime(key),
                receiver
              )
            })
          }
        case "entries":
        case Symbol.iterator:
          return function* () {
            for (const [key, value] of target.entries()) {
              yield [
                keyAdapter.toRuntime(key),
                valueAdapter.toRuntime(value, (newStoredValue) => {
                  target.set(key, newStoredValue)
                }),
              ] as const
            }
          }
        case "keys":
          return function* () {
            for (const key of target.keys()) {
              yield keyAdapter.toRuntime(key)
            }
          }
        case "values":
          return function* () {
            for (const [key, value] of target.entries()) {
              yield valueAdapter.toRuntime(value, (newStoredValue) => {
                target.set(key, newStoredValue)
              })
            }
          }
        default:
          return Reflect.get(target, prop, receiver)
      }
    },
  }) as unknown as Map<TKeyRuntime, TValueRuntime>
}

function makeObjectBackedMapTransform<TStoredValue, TRuntimeValue>(
  valueAdapter: RuntimeAdapter<TStoredValue, TRuntimeValue>
): ModelPropTransform<Record<string, TStoredValue>, Map<string, TRuntimeValue>> {
  const storedByRuntime = new WeakMap<Map<string, TRuntimeValue>, Record<string, TStoredValue>>()

  return {
    transform({ originalValue, cachedTransformedValue }) {
      if (cachedTransformedValue) {
        return cachedTransformedValue
      }

      const runtimeMap = makeMapProxy(asMap(originalValue), identityRuntimeAdapter, valueAdapter)

      storedByRuntime.set(runtimeMap, originalValue)
      return runtimeMap
    },

    untransform({ transformedValue }) {
      const cachedStored = storedByRuntime.get(transformedValue)
      if (cachedStored) {
        return cachedStored
      }

      const result: Record<string, TStoredValue> = {}
      transformedValue.forEach((value, key) => {
        result[key] = valueAdapter.toStored(value)
      })
      return result
    },
  }
}

function makeArrayBackedMapTransform<TKeyStored, TKeyRuntime, TValueStored, TValueRuntime>(
  keyAdapter: RuntimeAdapter<TKeyStored, TKeyRuntime>,
  valueAdapter: RuntimeAdapter<TValueStored, TValueRuntime>
): ModelPropTransform<Array<[TKeyStored, TValueStored]>, Map<TKeyRuntime, TValueRuntime>> {
  const storedByRuntime = new WeakMap<
    Map<TKeyRuntime, TValueRuntime>,
    Array<[TKeyStored, TValueStored]>
  >()

  return {
    transform({ originalValue, cachedTransformedValue }) {
      if (cachedTransformedValue) {
        return cachedTransformedValue
      }

      const runtimeMap = makeMapProxy(asMap(originalValue), keyAdapter, valueAdapter)

      storedByRuntime.set(runtimeMap, originalValue)
      return runtimeMap
    },

    untransform({ transformedValue }) {
      const cachedStored = storedByRuntime.get(transformedValue)
      if (cachedStored) {
        return cachedStored
      }

      const result: Array<[TKeyStored, TValueStored]> = []
      transformedValue.forEach((value, key) => {
        result.push([keyAdapter.toStored(key), valueAdapter.toStored(value)])
      })
      return result
    },
  }
}

export function typesMapFromObject<TValueType extends AnyType>(
  valueType: TValueType
): CodecFromEncoded<RecordType<TValueType>, Map<string, TypeToData<TValueType>>> {
  const valueSupport = resolveCodecSupport(valueType)

  return createCodecType(
    {
      typeName: "mapFromObject",
      encodedType: typesRecord(valueSupport.storedType),
      is(value): value is Map<string, TypeToData<TValueType>> {
        if (!isMap(value)) {
          return false
        }

        for (const key of value.keys()) {
          if (typeof key !== "string") {
            return false
          }
        }

        return true
      },
      ...makeObjectBackedMapTransform(valueSupport.adapter),
    },
    TypeCheckerBaseType.Object
  )
}

export function typesMapFromArray<TKeyType extends AnyType, TValueType extends AnyType>(
  keyType: TKeyType,
  valueType: TValueType
): CodecFromEncoded<
  ArrayType<ArrayType<[TKeyType, TValueType]>[]>,
  Map<TypeToData<TKeyType>, TypeToData<TValueType>>
> {
  const keySupport = resolveCodecSupport(keyType)
  const valueSupport = resolveCodecSupport(valueType)

  return createCodecType(
    {
      typeName: "mapFromArray",
      encodedType: typesArray(typesTuple(keySupport.storedType, valueSupport.storedType)),
      is(value): value is Map<TypeToData<TKeyType>, TypeToData<TValueType>> {
        return isMap(value)
      },
      ...makeArrayBackedMapTransform(keySupport.adapter, valueSupport.adapter),
    },
    TypeCheckerBaseType.Object
  )
}
