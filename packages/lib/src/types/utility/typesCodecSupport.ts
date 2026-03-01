import { isObservableArray, isObservableObject, remove } from "mobx"
import type { ModelPropTransform } from "../../modelShared/prop"
import { isArray, isObject, lazy } from "../../utils"
import { setIfDifferent } from "../../utils/setIfDifferent"
import { ArrayTypeInfo, typesArray } from "../arrayBased/typesArray"
import { TupleTypeInfo, typesTuple } from "../arrayBased/typesTuple"
import { getTypeInfo } from "../getTypeInfo"
import { isDataModelDataStandardType } from "../objectBased/typesDataModelData"
import { isModelStandardType } from "../objectBased/typesModel"
import { ObjectTypeInfo, typesObject } from "../objectBased/typesObject"
import { RecordTypeInfo, typesRecord } from "../objectBased/typesRecord"
import { resolveStandardType, resolveTypeChecker } from "../resolveTypeChecker"
import type { AnyStandardType, AnyType } from "../schemas"
import { lateTypeChecker } from "../TypeChecker"
import {
  getCodecMetadata,
  identityRuntimeAdapter,
  type ResolvedCodecSupport,
  type RuntimeAdapter,
} from "./typesCodecCore"
import { OrTypeInfo, typesOr } from "./typesOr"
import { RefinementTypeInfo } from "./typesRefinement"
import { SkipCheckTypeInfo, typesSkipCheck } from "./typesSkipCheck"
import { TagTypeInfo, typesTag } from "./typesTag"

const codecSupportCache = new WeakMap<AnyStandardType, ResolvedCodecSupport>()

function getArrayIndex(prop: PropertyKey): number | undefined {
  // Proxy get/set traps always receive string|symbol keys (ECMAScript ToPropertyKey),
  // so we only need to check for string numeric indices.
  if (typeof prop === "string" && /^(0|[1-9]\d*)$/.test(prop)) {
    return Number(prop)
  }

  return undefined
}

function normalizeArrayIndex(index: number, length: number): number {
  if (index < 0) {
    return Math.max(length + index, 0)
  }

  return Math.min(index, length)
}

function resolveArrayAtIndex(index: number, length: number): number | undefined {
  const resolvedIndex = index < 0 ? length + index : index

  if (resolvedIndex < 0 || resolvedIndex >= length) {
    return undefined
  }

  return resolvedIndex
}

/**
 * Common proxy traps shared between object and record runtime adapters.
 * Only deleteProperty needs special handling for MobX observable objects.
 */
const objectRecordProxyTraps: Pick<ProxyHandler<Record<string, unknown>>, "deleteProperty"> = {
  deleteProperty(target, prop) {
    if (typeof prop === "string" && isObservableObject(target)) {
      remove(target, prop)
      return true
    }

    return Reflect.deleteProperty(target, prop)
  },
}

/**
 * Converts a runtime object to its stored form using a cache.
 * Shared by object and record adapters.
 */
function objectLikeToStored(
  runtime: unknown,
  storedByRuntime: WeakMap<object, Record<string, unknown>>,
  convertValue: (key: string, value: unknown) => unknown
): Record<string, unknown> {
  if (isObject(runtime)) {
    const cachedStored = storedByRuntime.get(runtime)
    if (cachedStored) {
      return cachedStored
    }

    if (isArray(runtime)) {
      return runtime as never
    }
  } else {
    return runtime as never
  }

  const stored: Record<string, unknown> = {}
  for (const key of Object.keys(runtime)) {
    stored[key] = convertValue(key, runtime[key])
  }
  return stored
}

/**
 * Checks the stored cache for a runtime object.
 * Shared by object and record adapters.
 */
function objectLikeToStoredIfCached(
  runtime: unknown,
  storedByRuntime: WeakMap<object, Record<string, unknown>>
): { found: true; value: Record<string, unknown> } | { found: false } {
  if (isObject(runtime) && !isArray(runtime)) {
    const cachedStored = storedByRuntime.get(runtime)
    if (cachedStored) {
      return { found: true, value: cachedStored }
    }
  }

  return { found: false }
}

function createObjectRuntimeAdapter(
  getChildSupports: () => Record<string, ResolvedCodecSupport>
): RuntimeAdapter<Record<string, unknown>, Record<string, unknown>> {
  const runtimeByStored = new WeakMap<object, Record<string, unknown>>()
  const storedByRuntime = new WeakMap<object, Record<string, unknown>>()

  return {
    toRuntime(stored) {
      if (!isObject(stored) || isArray(stored)) {
        return stored as never
      }

      const cachedRuntime = runtimeByStored.get(stored)
      if (cachedRuntime) {
        return cachedRuntime
      }

      const proxy = new Proxy(stored, {
        get(target, prop, receiver) {
          if (typeof prop === "string") {
            const childSupport = getChildSupports()[prop]
            if (childSupport && Object.hasOwn(target, prop)) {
              return childSupport.adapter.toRuntime(target[prop], (newStoredValue) => {
                target[prop] = newStoredValue
              })
            }
          }

          return Reflect.get(target, prop, receiver)
        },

        set(target, prop, value) {
          if (typeof prop === "string") {
            const childSupport = getChildSupports()[prop]
            if (childSupport) {
              setIfDifferent(target, prop, childSupport.adapter.toStored(value))
              return true
            }
          }

          Reflect.set(target, prop, value)
          return true
        },

        ...objectRecordProxyTraps,
      })

      runtimeByStored.set(stored, proxy)
      storedByRuntime.set(proxy, stored)

      return proxy
    },

    toStored(runtime) {
      const childSupports = getChildSupports()
      return objectLikeToStored(runtime, storedByRuntime, (key, value) => {
        const childSupport = childSupports[key]
        return childSupport ? childSupport.adapter.toStored(value) : value
      })
    },

    toStoredIfCached(runtime) {
      return objectLikeToStoredIfCached(runtime, storedByRuntime)
    },
  }
}

function createRecordRuntimeAdapter(
  getValueSupport: () => ResolvedCodecSupport
): RuntimeAdapter<Record<string, unknown>, Record<string, unknown>> {
  const runtimeByStored = new WeakMap<object, Record<string, unknown>>()
  const storedByRuntime = new WeakMap<object, Record<string, unknown>>()

  return {
    toRuntime(stored) {
      if (!isObject(stored) || isArray(stored)) {
        return stored as never
      }

      const cachedRuntime = runtimeByStored.get(stored)
      if (cachedRuntime) {
        return cachedRuntime
      }

      const proxy = new Proxy(stored, {
        get(target, prop, receiver) {
          if (typeof prop === "string" && Object.hasOwn(target, prop)) {
            const valueSupport = getValueSupport()
            return valueSupport.adapter.toRuntime(target[prop], (newStoredValue) => {
              target[prop] = newStoredValue
            })
          }

          return Reflect.get(target, prop, receiver)
        },

        set(target, prop, value) {
          if (typeof prop === "string") {
            setIfDifferent(target, prop, getValueSupport().adapter.toStored(value))
            return true
          }

          Reflect.set(target, prop, value)
          return true
        },

        ...objectRecordProxyTraps,
      })

      runtimeByStored.set(stored, proxy)
      storedByRuntime.set(proxy, stored)

      return proxy
    },

    toStored(runtime) {
      const valueSupport = getValueSupport()
      return objectLikeToStored(runtime, storedByRuntime, (_key, value) =>
        valueSupport.adapter.toStored(value)
      )
    },

    toStoredIfCached(runtime) {
      return objectLikeToStoredIfCached(runtime, storedByRuntime)
    },
  }
}

function createArrayLikeRuntimeAdapter(
  getItemAdapter: (index: number) => RuntimeAdapter<unknown, unknown>
): RuntimeAdapter<unknown[], unknown[]> {
  const runtimeByStored = new WeakMap<unknown[], unknown[]>()
  const storedByRuntime = new WeakMap<unknown[], unknown[]>()

  const decodeIndex = (target: unknown[], index: number) =>
    index < 0 || index >= target.length || !Reflect.has(target, index)
      ? undefined
      : getItemAdapter(index).toRuntime(target[index], (newStoredValue) => {
          target[index] = newStoredValue
        })

  const callReadOnlyRuntimeMethod = (
    receiver: unknown[],
    methodName: PropertyKey,
    args: unknown[]
  ) => {
    const method = Reflect.get(Array.prototype, methodName, receiver)
    return Reflect.apply(method, receiver, args)
  }
  const materializeRuntimeValues = (target: unknown[]) =>
    Array.from({ length: target.length }, (_, index) => decodeIndex(target, index))
  const replaceStoredValues = (target: unknown[], runtimeValues: unknown[]) => {
    target.splice(
      0,
      target.length,
      ...runtimeValues.map((value, index) => getItemAdapter(index).toStored(value))
    )
  }
  const mutateViaRuntime = (
    target: unknown[],
    receiver: unknown[],
    fn: (values: unknown[]) => void
  ) => {
    const runtimeValues = materializeRuntimeValues(target)
    fn(runtimeValues)
    replaceStoredValues(target, runtimeValues)
    return receiver
  }

  return {
    toRuntime(stored) {
      if (!isArray(stored)) {
        return stored as never
      }

      const cachedRuntime = runtimeByStored.get(stored)
      if (cachedRuntime) {
        return cachedRuntime
      }

      const proxy: unknown[] = new Proxy(stored, {
        get(target, prop, receiver) {
          const index = getArrayIndex(prop)
          if (index !== undefined) {
            return decodeIndex(target, index)
          }

          // MobX 4 observable arrays are array-like but fail `Array.isArray`, so native
          // `Array.prototype.concat` won't spread this proxy unless we opt in explicitly.
          if (
            prop === Symbol.isConcatSpreadable &&
            isObservableArray(target) &&
            !Array.isArray(target)
          ) {
            return true
          }

          switch (prop) {
            case "at":
              return (indexValue: number) => {
                const resolvedIndex = resolveArrayAtIndex(indexValue, target.length)
                return resolvedIndex === undefined ? undefined : decodeIndex(target, resolvedIndex)
              }
            case "push":
              return (...items: unknown[]) =>
                target.push(
                  ...items.map((item, offset) =>
                    getItemAdapter(target.length + offset).toStored(item)
                  )
                )
            case "pop":
              return () => {
                if (target.length <= 0) {
                  return undefined
                }

                const indexValue = target.length - 1
                const value = target.pop()
                return getItemAdapter(indexValue).toRuntime(value)
              }
            case "shift":
              return () => {
                if (target.length <= 0) {
                  return undefined
                }

                const value = target.shift()
                return getItemAdapter(0).toRuntime(value)
              }
            case "unshift":
              return (...items: unknown[]) =>
                target.unshift(
                  ...items.map((item, indexValue) => getItemAdapter(indexValue).toStored(item))
                )
            case "splice":
              return (start: number, deleteCount?: number, ...items: unknown[]) => {
                const normalizedStart = normalizeArrayIndex(start, target.length)
                const actualDeleteCount =
                  deleteCount === undefined
                    ? target.length - normalizedStart
                    : Math.max(0, Math.min(deleteCount, target.length - normalizedStart))

                const removedValues = target
                  .slice(normalizedStart, normalizedStart + actualDeleteCount)
                  .map((value, indexValue) =>
                    getItemAdapter(normalizedStart + indexValue).toRuntime(value)
                  )

                target.splice(
                  normalizedStart,
                  actualDeleteCount,
                  ...items.map((item, indexValue) =>
                    getItemAdapter(normalizedStart + indexValue).toStored(item)
                  )
                )

                return removedValues
              }
            case "reverse":
              return () => mutateViaRuntime(target, receiver, (v) => v.reverse())
            case "sort":
              return (compareFn?: (a: unknown, b: unknown) => number) =>
                mutateViaRuntime(target, receiver, (v) => v.sort(compareFn))
            case "fill":
              return (value: unknown, start?: number, end?: number) =>
                mutateViaRuntime(target, receiver, (v) => v.fill(value, start, end))
            case "copyWithin":
              return (targetIndex: number, start?: number, end?: number) =>
                mutateViaRuntime(target, receiver, (v) =>
                  v.copyWithin(targetIndex, start ?? 0, end)
                )
            case "concat":
            case "flat":
            case "flatMap":
            case "filter":
            case "find":
            case "findIndex":
            case "forEach":
            case "every":
            case "includes":
            case "indexOf":
            case "join":
            case "lastIndexOf":
            case "map":
            case "reduce":
            case "reduceRight":
            case "slice":
            case "some":
            case "findLast":
            case "findLastIndex":
            case "toReversed":
            case "toSorted":
            case "toSpliced":
            case "toString":
            case "toLocaleString":
            case "with":
              return (...args: unknown[]) => callReadOnlyRuntimeMethod(receiver, prop, args)
            case "entries":
              return function* () {
                for (let i = 0; i < target.length; i++) {
                  yield [i, decodeIndex(target, i)] as const
                }
              }
            case "keys":
              return function* () {
                for (let i = 0; i < target.length; i++) {
                  yield i
                }
              }
            case "values":
            case Symbol.iterator:
              return function* () {
                for (let i = 0; i < target.length; i++) {
                  yield decodeIndex(target, i)
                }
              }
            default:
              return Reflect.get(target, prop, receiver)
          }
        },

        set(target, prop, value) {
          const index = getArrayIndex(prop)
          if (index !== undefined) {
            target[index] = getItemAdapter(index).toStored(value)
            return true
          }

          Reflect.set(target, prop, value)
          return true
        },
      })

      runtimeByStored.set(stored, proxy)
      storedByRuntime.set(proxy, stored)

      return proxy
    },

    toStored(runtime) {
      if (isArray(runtime)) {
        const cachedStored = storedByRuntime.get(runtime)
        if (cachedStored) {
          return cachedStored
        }

        return Array.from(runtime, (value, index) => getItemAdapter(index).toStored(value))
      }

      return runtime as never
    },

    toStoredIfCached(runtime) {
      if (isArray(runtime)) {
        const cachedStored = storedByRuntime.get(runtime)
        if (cachedStored) {
          return { found: true, value: cachedStored }
        }
      }

      return { found: false }
    },
  }
}

function createCodecLeafRuntimeAdapter(
  transform: ModelPropTransform<unknown, unknown>
): RuntimeAdapter<unknown, unknown> {
  const runtimeByStored = new WeakMap<object, unknown>()
  const storedByRuntime = new WeakMap<object, unknown>()

  return {
    toRuntime(stored, setStored) {
      const cachedRuntime = isObject(stored) ? runtimeByStored.get(stored) : undefined

      const runtime = transform.transform({
        originalValue: stored,
        cachedTransformedValue: cachedRuntime,
        setOriginalValue(newStoredValue) {
          if (setStored) {
            setStored(newStoredValue)
          }
        },
      })

      if (isObject(runtime)) {
        storedByRuntime.set(runtime, stored)
      }

      if (isObject(stored)) {
        runtimeByStored.set(stored, runtime)
      }

      return runtime
    },

    toStored(runtime) {
      const cachedStored = isObject(runtime) ? storedByRuntime.get(runtime) : undefined
      if (cachedStored !== undefined) {
        return cachedStored
      }

      const stored = transform.untransform({
        transformedValue: runtime,
        cacheTransformedValue: () => {},
      })

      if (isObject(runtime)) {
        storedByRuntime.set(runtime, stored)
      }

      if (isObject(stored)) {
        runtimeByStored.set(stored, runtime)
      }

      return stored
    },

    toStoredIfCached(runtime) {
      if (isObject(runtime)) {
        const cachedStored = storedByRuntime.get(runtime)
        if (cachedStored !== undefined) {
          return { found: true, value: cachedStored }
        }
      }

      return { found: false }
    },
  }
}

function createOrRuntimeAdapter(
  childTypes: ReadonlyArray<AnyStandardType>,
  getChildSupports: () => ReadonlyArray<ResolvedCodecSupport>,
  dispatcher: OrTypeInfo["dispatcher"]
): RuntimeAdapter<unknown, unknown> {
  const getRuntimeSupportForValue = (value: unknown) => {
    const supports = getChildSupports()
    for (let i = 0; i < supports.length; i++) {
      const childType = childTypes[i]
      const tc = resolveTypeChecker(childType)
      if (tc.skipCheck) {
        // For skipCheck branches, use snapshotType for structural matching
        // instead of check (which always passes and would match any value)
        if (tc.snapshotType(value)) {
          return supports[i]
        }
      } else if (!tc.check(value, [], value)) {
        return supports[i]
      }
    }

    return supports[0]
  }

  const getStoredSupportForValue = (value: unknown) => {
    if (dispatcher) {
      return resolveCodecSupport(dispatcher(value))
    }

    const supports = getChildSupports()
    for (let i = 0; i < supports.length; i++) {
      const storedTypeChecker = resolveTypeChecker(supports[i].storedType)
      if (storedTypeChecker.snapshotType(value)) {
        return supports[i]
      }
    }

    return supports[0]
  }

  return {
    toRuntime(stored, setStored) {
      return getStoredSupportForValue(stored).adapter.toRuntime(stored, setStored)
    },

    toStored(runtime) {
      return getRuntimeSupportForValue(runtime).adapter.toStored(runtime)
    },

    toStoredIfCached(runtime) {
      return getRuntimeSupportForValue(runtime).adapter.toStoredIfCached(runtime)
    },
  }
}

function noCodecSupport(type: AnyStandardType): ResolvedCodecSupport {
  return { hasCodec: false, storedType: type, adapter: identityRuntimeAdapter }
}

function resolveCodecSupportForStandardType(type: AnyStandardType): ResolvedCodecSupport {
  const cachedSupport = codecSupportCache.get(type)
  if (cachedSupport) {
    return cachedSupport
  }

  let resolvedSupport: ResolvedCodecSupport | undefined
  let resolvedStoredType: AnyStandardType | undefined

  const placeholderSupport: ResolvedCodecSupport = {
    hasCodec: false,
    storedType: lateTypeChecker(
      () => resolveTypeChecker(resolvedStoredType ?? type),
      () => getTypeInfo(resolvedStoredType ?? type)
    ) as any,
    adapter: {
      toRuntime(stored, setStored) {
        return (resolvedSupport?.adapter ?? identityRuntimeAdapter).toRuntime(stored, setStored)
      },

      toStored(runtime) {
        return (resolvedSupport?.adapter ?? identityRuntimeAdapter).toStored(runtime)
      },

      toStoredIfCached(runtime) {
        return (resolvedSupport?.adapter ?? identityRuntimeAdapter).toStoredIfCached(runtime)
      },
    },
  }

  codecSupportCache.set(type, placeholderSupport)

  const codecMetadata = getCodecMetadata(type)
  if (codecMetadata) {
    resolvedSupport = {
      hasCodec: true,
      storedType: resolveStandardType(codecMetadata.encodedType),
      adapter: createCodecLeafRuntimeAdapter(codecMetadata.transform),
    }
  } else if (isModelStandardType(type) || isDataModelDataStandardType(type)) {
    resolvedSupport = noCodecSupport(type)
  } else {
    const typeInfo = getTypeInfo(type)

    if (typeInfo instanceof ArrayTypeInfo) {
      const itemSupport = lazy(() => resolveCodecSupportForStandardType(typeInfo.itemType))

      resolvedSupport = !itemSupport().hasCodec
        ? noCodecSupport(type)
        : {
            hasCodec: true,
            storedType: typesArray(itemSupport().storedType),
            adapter: createArrayLikeRuntimeAdapter(() => itemSupport().adapter),
          }
    } else if (typeInfo instanceof TupleTypeInfo) {
      const itemSupports = lazy(() =>
        typeInfo.itemTypes.map((itemType) => resolveCodecSupportForStandardType(itemType))
      )

      resolvedSupport = !itemSupports().some((itemSupport) => itemSupport.hasCodec)
        ? noCodecSupport(type)
        : {
            hasCodec: true,
            storedType: typesTuple(...itemSupports().map((itemSupport) => itemSupport.storedType)),
            adapter: createArrayLikeRuntimeAdapter(
              (index) => itemSupports()[index]?.adapter ?? identityRuntimeAdapter
            ),
          }
    } else if (typeInfo instanceof ObjectTypeInfo) {
      const childSupports = lazy(() => {
        const supports: Record<string, ResolvedCodecSupport> = {}
        const props = typeInfo.props
        for (const propName of Object.keys(props)) {
          supports[propName] = resolveCodecSupportForStandardType(props[propName].type)
        }
        return supports
      })

      resolvedSupport = !Object.values(childSupports()).some(
        (childSupport) => childSupport.hasCodec
      )
        ? noCodecSupport(type)
        : {
            hasCodec: true,
            storedType: typesObject(() => {
              const storedProps: Record<string, AnyStandardType> = {}
              const props = typeInfo.props
              for (const propName of Object.keys(props)) {
                storedProps[propName] = childSupports()[propName].storedType
              }
              return storedProps
            }),
            adapter: createObjectRuntimeAdapter(childSupports),
          }
    } else if (typeInfo instanceof RecordTypeInfo) {
      const valueSupport = lazy(() => resolveCodecSupportForStandardType(typeInfo.valueType))

      resolvedSupport = !valueSupport().hasCodec
        ? noCodecSupport(type)
        : {
            hasCodec: true,
            storedType: typesRecord(valueSupport().storedType),
            adapter: createRecordRuntimeAdapter(valueSupport),
          }
    } else if (typeInfo instanceof TagTypeInfo) {
      const baseSupport = resolveCodecSupportForStandardType(typeInfo.baseType)

      resolvedSupport = !baseSupport.hasCodec
        ? noCodecSupport(type)
        : {
            hasCodec: true,
            storedType: typesTag(baseSupport.storedType, typeInfo.tag, typeInfo.typeName),
            adapter: baseSupport.adapter,
          }
    } else if (typeInfo instanceof RefinementTypeInfo) {
      const baseSupport = resolveCodecSupportForStandardType(typeInfo.baseType)

      resolvedSupport = baseSupport.hasCodec ? baseSupport : noCodecSupport(type)
    } else if (typeInfo instanceof SkipCheckTypeInfo) {
      const baseSupport = resolveCodecSupportForStandardType(typeInfo.baseType)

      // Always wrap storedType with skipCheck, even when hasCodec is false.
      // resolveStoredType() feeds model-internal automatic validation in sharedInternalModel.ts,
      // so the skipCheck wrapper must propagate to prevent the stored type from being validated.
      resolvedSupport = {
        hasCodec: baseSupport.hasCodec,
        storedType: typesSkipCheck(baseSupport.storedType),
        adapter: baseSupport.adapter,
      }
    } else if (typeInfo instanceof OrTypeInfo) {
      const childSupports = lazy(() =>
        typeInfo.orTypes.map((orType) => resolveCodecSupportForStandardType(orType))
      )

      resolvedSupport = !childSupports().some((childSupport) => childSupport.hasCodec)
        ? noCodecSupport(type)
        : {
            hasCodec: true,
            storedType: typeInfo.dispatcher
              ? typesOr(
                  (snapshot) => resolveStoredType(typeInfo.dispatcher!(snapshot)),
                  ...childSupports().map((childSupport) => childSupport.storedType)
                )
              : typesOr(...childSupports().map((childSupport) => childSupport.storedType)),
            adapter: createOrRuntimeAdapter(typeInfo.orTypes, childSupports, typeInfo.dispatcher),
          }
    } else {
      resolvedSupport = noCodecSupport(type)
    }
  }

  resolvedStoredType = resolvedSupport.storedType
  placeholderSupport.hasCodec = resolvedSupport.hasCodec
  placeholderSupport.storedType = resolvedSupport.storedType
  placeholderSupport.adapter = resolvedSupport.adapter

  return placeholderSupport
}

export function resolveCodecSupport(type: AnyType) {
  return resolveCodecSupportForStandardType(resolveStandardType(type))
}

export function resolveStoredType(type: AnyType) {
  return resolveCodecSupport(type).storedType
}

export function resolveStoredTypeChecker(type: AnyType) {
  return resolveTypeChecker(resolveCodecSupport(type).storedType)
}

export function createCodecPropTransform(type: AnyType): ModelPropTransform<any, unknown> {
  const adapter = resolveCodecSupport(type).adapter

  return {
    transform({ originalValue, cachedTransformedValue, setOriginalValue }) {
      // For leaf codecs backed by primitive stored data (e.g. timestamps, ISO strings),
      // the adapter's WeakMap cache can't work. Thread the model's cachedTransformedValue
      // to avoid creating new runtime objects when the stored value hasn't changed.
      if (cachedTransformedValue !== undefined) {
        const cachedStored = adapter.toStoredIfCached(cachedTransformedValue)
        if (cachedStored.found && cachedStored.value === originalValue) {
          return cachedTransformedValue
        }
      }
      return adapter.toRuntime(originalValue, setOriginalValue)
    },

    untransform({ transformedValue, cacheTransformedValue }) {
      const cachedStored = adapter.toStoredIfCached(transformedValue)
      if (cachedStored.found) {
        cacheTransformedValue()
        return cachedStored.value
      }

      return adapter.toStored(transformedValue)
    },
  }
}
