import type { ModelPropTransform } from "../../modelShared/prop"
import { isMap, setProtoProp } from "../../utils"
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
  // Writes through the decoded value must land back on the entry it came from.
  const toRuntimeValue = (storedKey: TKeyStored, storedValue: TValueStored): TValueRuntime =>
    valueAdapter.toRuntime(storedValue, (newStoredValue) => {
      storedMap.set(storedKey, newStoredValue)
    })

  const getValue = (storedKey: TKeyStored): TValueRuntime =>
    toRuntimeValue(storedKey, storedMap.get(storedKey) as TValueStored)

  return new Proxy(storedMap, {
    get(target, prop, receiver) {
      switch (prop) {
        case "get":
          return (key: TKeyRuntime) => {
            const storedKey = keyAdapter.toStored(key)
            if (!target.has(storedKey)) {
              return undefined
            }

            return getValue(storedKey)
          }
        case "getOrInsert":
        case "getOrInsertComputed":
          return (key: TKeyRuntime, valueOrCallback: unknown) => {
            const storedKey = keyAdapter.toStored(key)
            if (!target.has(storedKey)) {
              const value =
                prop === "getOrInsert"
                  ? (valueOrCallback as TValueRuntime)
                  : (valueOrCallback as (key: TKeyRuntime) => TValueRuntime)(key)
              target.set(storedKey, valueAdapter.toStored(value))
            }
            return getValue(storedKey)
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
                toRuntimeValue(key, value),
                keyAdapter.toRuntime(key),
                receiver
              )
            })
          }
        case "entries":
        case Symbol.iterator:
          return function* () {
            for (const [key, value] of target.entries()) {
              yield [keyAdapter.toRuntime(key), toRuntimeValue(key, value)] as const
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
              yield toRuntimeValue(key, value)
            }
          }
        default:
          return Reflect.get(target, prop, receiver)
      }
    },
  }) as unknown as Map<TKeyRuntime, TValueRuntime>
}

function makeMapTransform<
  TStored extends object,
  TKeyStored,
  TKeyRuntime,
  TValueStored,
  TValueRuntime,
>(
  keyAdapter: RuntimeAdapter<TKeyStored, TKeyRuntime>,
  valueAdapter: RuntimeAdapter<TValueStored, TValueRuntime>,
  toStored: (runtimeMap: Map<TKeyRuntime, TValueRuntime>) => TStored
): ModelPropTransform<TStored, Map<TKeyRuntime, TValueRuntime>> {
  const storedByRuntime = new WeakMap<Map<TKeyRuntime, TValueRuntime>, TStored>()

  return {
    transform({ originalValue, cachedTransformedValue }) {
      if (cachedTransformedValue) {
        return cachedTransformedValue
      }

      const runtimeMap = makeMapProxy(
        asMap(originalValue as any) as Map<TKeyStored, TValueStored>,
        keyAdapter,
        valueAdapter
      )

      storedByRuntime.set(runtimeMap, originalValue)
      return runtimeMap
    },

    untransform({ transformedValue }) {
      return storedByRuntime.get(transformedValue) ?? toStored(transformedValue)
    },
  }
}

function makeObjectBackedMapTransform<TStoredValue, TRuntimeValue>(
  valueAdapter: RuntimeAdapter<TStoredValue, TRuntimeValue>
): ModelPropTransform<Record<string, TStoredValue>, Map<string, TRuntimeValue>> {
  return makeMapTransform(
    identityRuntimeAdapter as RuntimeAdapter<string, string>,
    valueAdapter,
    (runtimeMap) => {
      const result: Record<string, TStoredValue> = {}
      runtimeMap.forEach((value, key) => {
        const storedValue = valueAdapter.toStored(value)
        if (key === "__proto__") setProtoProp(result, storedValue)
        else result[key] = storedValue
      })
      return result
    }
  )
}

function makeArrayBackedMapTransform<TKeyStored, TKeyRuntime, TValueStored, TValueRuntime>(
  keyAdapter: RuntimeAdapter<TKeyStored, TKeyRuntime>,
  valueAdapter: RuntimeAdapter<TValueStored, TValueRuntime>
): ModelPropTransform<Array<[TKeyStored, TValueStored]>, Map<TKeyRuntime, TValueRuntime>> {
  return makeMapTransform(keyAdapter, valueAdapter, (runtimeMap) => {
    const result: Array<[TKeyStored, TValueStored]> = []
    runtimeMap.forEach((value, key) => {
      result.push([keyAdapter.toStored(key), valueAdapter.toStored(value)])
    })
    return result
  })
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
