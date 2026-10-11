import { frozenKey } from "../frozen/Frozen"
import { modelTypeKey } from "../model/metadata"
import type { PathElement } from "../parent/pathTypes"
import { copyOwnEnumerableProps, hasOwnProp, isArray, isObject, isPlainObject } from "../utils"
import { getCurrentErrorDiagnosticsContext } from "../utils/errorDiagnostics"
import { builtinEncodedTypeof, unmarkedEncodingSymbol } from "./builtinSerializers"
import { badPayloadError, CallError, CallErrorCode } from "./CallError"
import type { JsonValue } from "./JsonValue"
import type { DecodeContext, EncodeContext, ValueSerializer } from "./ValueSerializer"
import { serializationMarkerKey } from "./ValueSerializer"

/**
 * @internal
 *
 * The tag of an escaped plain object: `{ "$mobxKeystone": "object", "v": { ...fields } }`.
 */
export const escapedObjectTag = "object"

const maxDecodeDepth = 1000

const reservedKeys: readonly string[] = [serializationMarkerKey, modelTypeKey, frozenKey]

/**
 * @internal
 */
export interface SerializerConfig {
  /**
   * Custom serializers followed by the built-ins (if any).
   */
  readonly serializers: readonly ValueSerializer[]
  /**
   * The serializers that could encode a value, by its `typeof`, or `"plain"` for plain arrays and
   * objects, which no built-in encodes (custom ones are in every list).
   */
  readonly byTypeof: ReadonlyMap<SerializerGroup, readonly ValueSerializer[]>
  readonly byTag: ReadonlyMap<string, ValueSerializer>
  /**
   * The serializer that decodes values with `$modelType` / `$frozen` (the snapshot serializer),
   * if in the list.
   */
  readonly unmarked: ValueSerializer | undefined
}

const typeofResults = [
  "string",
  "number",
  "bigint",
  "boolean",
  "symbol",
  "undefined",
  "object",
  "function",
] as const

/**
 * @internal
 */
export type TypeofResult = (typeof typeofResults)[number]

type SerializerGroup = TypeofResult | "plain"

/**
 * @internal
 *
 * Groups serializers by the `typeof` of the values they could encode, plus `"plain"` for plain
 * arrays and objects, keeping their order.
 */
export function groupSerializersByTypeof(
  serializers: readonly ValueSerializer[]
): ReadonlyMap<SerializerGroup, readonly ValueSerializer[]> {
  const byTypeof = new Map<SerializerGroup, readonly ValueSerializer[]>(
    typeofResults.map((t) => [
      t,
      serializers.filter((s) => {
        const encodedTypeof = builtinEncodedTypeof.get(s)
        return encodedTypeof === undefined || encodedTypeof === t
      }),
    ])
  )
  byTypeof.set(
    "plain",
    serializers.filter((s) => !builtinEncodedTypeof.has(s))
  )
  return byTypeof
}

type PlainKind = "array" | "object" | undefined

function getPlainKind(value: unknown): PlainKind {
  if (!isObject(value)) {
    return undefined
  }
  if (isArray(value)) {
    return "array"
  }
  return isPlainObject(value) ? "object" : undefined
}

/**
 * Runs `fn` with `key` pushed to the error path (without allocating a closure per value).
 */
function withPathSegment<A, R>(key: PathElement, fn: (arg: A) => R, arg: A): R {
  const diagnostics = getCurrentErrorDiagnosticsContext()
  if (!diagnostics) {
    return fn(arg)
  }
  diagnostics.pushPath(key)
  try {
    return fn(arg)
  } finally {
    diagnostics.popPath()
  }
}

/**
 * @internal
 */
export function isUnmarkedSerializer(serializer: ValueSerializer): boolean {
  return unmarkedEncodingSymbol in serializer
}

/**
 * @internal
 */
export function markValue(tag: string, payload: JsonValue | undefined): JsonValue {
  return payload === undefined
    ? { [serializationMarkerKey]: tag }
    : { [serializationMarkerKey]: tag, v: payload }
}

function wrapSerializerError(
  error: unknown,
  code: CallErrorCode,
  tag: string,
  value: unknown
): CallError {
  if (error instanceof CallError) {
    return error
  }
  const op = code === CallErrorCode.CannotEncode ? "encode" : "decode"
  return new CallError({
    code,
    message: `the '${tag}' serializer failed to ${op} the value`,
    previewValue: value,
    cause: error,
  })
}

function describeValue(value: unknown): string {
  switch (typeof value) {
    case "function":
      return "a function"
    case "symbol":
      return "a symbol"
    case "object": {
      const proto = value === null ? null : Object.getPrototypeOf(value)
      const name = proto?.constructor?.name
      return name ? `an instance of ${name}` : "an object"
    }
    default:
      return String(value)
  }
}

/**
 * @internal
 *
 * Creates the encoding context for one encoding: `ctx.encode` encodes any value, going through
 * the list of serializers. It must run inside an error diagnostics context.
 */
export function createEncodeContext(config: SerializerConfig, root: object): EncodeContext {
  // values being encoded, to detect cycles
  const ancestors = new Set<unknown>()

  const encodeWithSerializer = (serializer: ValueSerializer, value: unknown): JsonValue => {
    let payload: JsonValue | undefined
    try {
      payload = serializer.encode(value, ctx)
    } catch (e) {
      throw wrapSerializerError(e, CallErrorCode.CannotEncode, serializer.tag, value)
    }
    return isUnmarkedSerializer(serializer) ? payload! : markValue(serializer.tag, payload)
  }

  const encodePlain = (value: unknown, plainKind: PlainKind): JsonValue => {
    if (value === null || typeof value === "string" || typeof value === "boolean") {
      return value
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
    if (plainKind === "array") {
      const array = value as readonly unknown[]
      const len = array.length
      const out: JsonValue[] = new Array(len)
      for (let i = 0; i < len; i++) {
        out[i] = ctx.encode(array[i], i)
      }
      return out
    }
    if (plainKind === "object") {
      const object = value as Record<string, unknown>
      const out = copyOwnEnumerableProps({} as Record<string, JsonValue>, object, ctx.encode)
      return reservedKeys.some((k) => hasOwnProp(object, k))
        ? markValue(escapedObjectTag, out)
        : out
    }
    throw new CallError({
      code: CallErrorCode.CannotEncode,
      message: `cannot encode ${describeValue(value)}: no serializer handles it`,
      previewValue: value,
    })
  }

  const encodeAny = (value: unknown): JsonValue => {
    const plainKind = getPlainKind(value)
    const serializers = config.byTypeof.get(plainKind ? "plain" : typeof value)!
    const len = serializers.length
    for (let i = 0; i < len; i++) {
      const serializer = serializers[i]
      let claimed: boolean
      try {
        claimed = serializer.is(value, ctx)
      } catch (e) {
        throw wrapSerializerError(e, CallErrorCode.CannotEncode, serializer.tag, value)
      }
      if (claimed) {
        return encodeWithSerializer(serializer, value)
      }
    }
    return encodePlain(value, plainKind)
  }

  const encodeChecked = (value: unknown): JsonValue => {
    if (!isObject(value) && typeof value !== "function") {
      return encodeAny(value)
    }
    if (ancestors.has(value)) {
      throw new CallError({
        code: CallErrorCode.CannotEncode,
        message: "cannot encode a value that contains itself",
      })
    }
    ancestors.add(value)
    try {
      return encodeAny(value)
    } finally {
      ancestors.delete(value)
    }
  }

  const ctx: EncodeContext = {
    root,
    encode(value: unknown, key?: PathElement): JsonValue {
      return key === undefined ? encodeChecked(value) : withPathSegment(key, encodeChecked, value)
    },
  }

  return ctx
}

/**
 * @internal
 *
 * Creates the decoding context for one decoding: `ctx.decode` decodes any JSON value. It must run
 * inside an error diagnostics context.
 */
export function createDecodeContext(config: SerializerConfig, root: object): DecodeContext {
  const decodeWithSerializer = (serializer: ValueSerializer, json: unknown): unknown => {
    try {
      return serializer.decode(json, ctx)
    } catch (e) {
      throw wrapSerializerError(e, CallErrorCode.BadArgument, serializer.tag, json)
    }
  }

  const decodeFields = (json: Record<string, unknown>): Record<string, unknown> =>
    copyOwnEnumerableProps({} as Record<string, unknown>, json, (v, k) =>
      ctx.decode(v as JsonValue, k)
    )

  const decodeMarked = (json: Record<string, unknown>): unknown => {
    const tag = json[serializationMarkerKey]
    if (tag === escapedObjectTag) {
      if (!isPlainObject(json.v)) {
        throw badPayloadError(escapedObjectTag, json)
      }
      return decodeFields(json.v)
    }

    const serializer = typeof tag === "string" ? config.byTag.get(tag) : undefined
    if (!serializer) {
      throw new CallError({
        code: CallErrorCode.BadArgument,
        message: `no serializer handles the tag ${JSON.stringify(tag)}`,
        previewValue: json,
      })
    }
    return decodeWithSerializer(serializer, json.v)
  }

  const decodeAny = (json: unknown): unknown => {
    if (
      json === null ||
      typeof json === "string" ||
      typeof json === "number" ||
      typeof json === "boolean"
    ) {
      return json
    }
    if (isArray(json)) {
      return json.map((v, i) => ctx.decode(v, i))
    }
    if (isPlainObject(json)) {
      if (hasOwnProp(json, serializationMarkerKey)) {
        return decodeMarked(json)
      }
      if (config.unmarked && (hasOwnProp(json, modelTypeKey) || hasOwnProp(json, frozenKey))) {
        return decodeWithSerializer(config.unmarked, json)
      }
      return decodeFields(json)
    }
    throw new CallError({
      code: CallErrorCode.BadArgument,
      message: `cannot decode ${describeValue(json)}: it is not a JSON value`,
      previewValue: json,
    })
  }

  // the JSON may come from anyone, so its nesting is limited before it overflows the stack
  let depth = 0

  const ctx: DecodeContext = {
    root,
    decode(json: JsonValue, key?: PathElement): unknown {
      if (depth >= maxDecodeDepth) {
        throw new CallError({
          code: CallErrorCode.BadArgument,
          message: `the value is nested more than ${maxDecodeDepth} levels deep`,
        })
      }
      depth++
      try {
        return key === undefined ? decodeAny(json) : withPathSegment(key, decodeAny, json)
      } finally {
        depth--
      }
    },
  }

  return ctx
}
