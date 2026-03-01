import { type ObservableSet } from "mobx"
import type { ModelPropTransform } from "../../modelShared/prop"
import { isSet } from "../../utils"
import { asSet } from "../../wrappers/asSet"
import { typesArray } from "../arrayBased/typesArray"
import type { AnyType, ArrayType, TypeToData } from "../schemas"
import { TypeCheckerBaseType } from "../TypeChecker"
import type { CodecFromEncoded, RuntimeAdapter } from "./typesCodecCore"
import { createCodecType } from "./typesCodecCore"
import { resolveCodecSupport } from "./typesCodecSupport"

function makeArrayBackedSetTransform<TStored, TRuntime>(
  valueAdapter: RuntimeAdapter<TStored, TRuntime>
): ModelPropTransform<Array<TStored>, Set<TRuntime> | ObservableSet<TRuntime>> {
  const storedByRuntime = new WeakMap<Set<TRuntime> | ObservableSet<TRuntime>, Array<TStored>>()

  return {
    transform({ originalValue, cachedTransformedValue }) {
      if (cachedTransformedValue) {
        return cachedTransformedValue
      }

      const storedSet = asSet(originalValue)

      const runtimeSet: Set<TRuntime> | ObservableSet<TRuntime> = new Proxy(storedSet, {
        get(target, prop, receiver) {
          switch (prop) {
            case "has":
              return (value: TRuntime) => target.has(valueAdapter.toStored(value))
            case "add":
              return (value: TRuntime) => {
                target.add(valueAdapter.toStored(value))
                return receiver
              }
            case "delete":
              return (value: TRuntime) => target.delete(valueAdapter.toStored(value))
            case "clear":
              return () => target.clear()
            case "size":
              return target.size
            case "forEach":
              return (
                callback: (
                  value: TRuntime,
                  key: TRuntime,
                  set: Set<TRuntime> | ObservableSet<TRuntime>
                ) => void,
                thisArg?: unknown
              ) => {
                target.forEach((value) => {
                  const runtimeValue = valueAdapter.toRuntime(value)
                  callback.call(thisArg, runtimeValue, runtimeValue, receiver)
                })
              }
            case "entries":
              return function* () {
                for (const value of target.values()) {
                  const runtimeValue = valueAdapter.toRuntime(value)
                  yield [runtimeValue, runtimeValue] as const
                }
              }
            case "keys":
            case "values":
            case Symbol.iterator:
              return function* () {
                for (const value of target.values()) {
                  yield valueAdapter.toRuntime(value)
                }
              }
            default:
              return Reflect.get(target, prop, receiver)
          }
        },
      }) as unknown as Set<TRuntime> | ObservableSet<TRuntime>

      storedByRuntime.set(runtimeSet, originalValue)
      return runtimeSet
    },

    untransform({ transformedValue }) {
      const cachedStored = storedByRuntime.get(transformedValue)
      if (cachedStored) {
        return cachedStored
      }

      return Array.from(transformedValue.values()).map((value) => valueAdapter.toStored(value))
    },
  }
}

export function typesSetFromArray<TValueType extends AnyType>(
  valueType: TValueType
): CodecFromEncoded<
  ArrayType<TValueType[]>,
  Set<TypeToData<TValueType>> | ObservableSet<TypeToData<TValueType>>
> {
  const valueSupport = resolveCodecSupport(valueType)

  return createCodecType(
    {
      typeName: "setFromArray",
      encodedType: typesArray(valueSupport.storedType),
      is(value): value is Set<TypeToData<TValueType>> | ObservableSet<TypeToData<TValueType>> {
        return isSet(value)
      },
      ...makeArrayBackedSetTransform(valueSupport.adapter),
    },
    TypeCheckerBaseType.Object
  )
}
