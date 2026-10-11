import type { AnyDataModel } from "../dataModel/BaseDataModel"
import { isDataModel, isDataModelClass } from "../dataModel/utils"
import { Frozen } from "../frozen/Frozen"
import { isModel } from "../model/utils"
import { findModelInfoForPrototype, getModelInfoForName } from "../modelShared/modelInfo"
import { fromSnapshot } from "../snapshot/fromSnapshot"
import { getSnapshot } from "../snapshot/getSnapshot"
import { hasOwnProp, isArray, isMap, isPlainObject, isSet } from "../utils"
import { badPayloadError, CallError, CallErrorCode } from "./CallError"
import type { TypeofResult } from "./codec"
import type { JsonValue } from "./JsonValue"
import type { ValueSerializer } from "./ValueSerializer"

/**
 * @internal
 *
 * The tag of the serializer whose encoded value is written as it is, without the marker
 * (snapshots already mark themselves), and that decodes every value with `$modelType` / `$frozen`.
 */
export const snapshotTag = "snapshot"

const snapshotSerializer: ValueSerializer<object, any> = {
  tag: snapshotTag,

  is(value): value is object {
    return isModel(value) || value instanceof Frozen
  },

  encode(value) {
    return getSnapshot(value)
  },

  decode(json, ctx) {
    return fromSnapshot<object>(json, { generateNewIds: ctx.generateNewIds })
  },
}

const dataModelSerializer: ValueSerializer<AnyDataModel, { type: string; data: JsonValue }> = {
  tag: "dataModel",

  is(value): value is AnyDataModel {
    return isDataModel(value)
  },

  encode(value, ctx) {
    // data models can only be created from registered classes
    const modelInfo = findModelInfoForPrototype(Object.getPrototypeOf(value))!
    return { type: modelInfo.name, data: ctx.encode(value.$) }
  },

  decode(json, ctx) {
    if (!isPlainObject(json) || typeof json.type !== "string" || !hasOwnProp(json, "data")) {
      throw badPayloadError("dataModel", json)
    }
    const modelInfo = getModelInfoForName(json.type)
    if (!modelInfo || !isDataModelClass(modelInfo.class)) {
      throw new CallError({
        code: CallErrorCode.BadArgument,
        message: `no data model is registered as '${json.type}'`,
        previewValue: json,
      })
    }
    return new modelInfo.class(ctx.decode(json.data))
  },
}

const dateSerializer: ValueSerializer<Date, string | number | null> = {
  tag: "date",

  is(value): value is Date {
    return value instanceof Date
  },

  encode(value) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  },

  decode(json) {
    if (json === null) {
      return new Date(Number.NaN)
    }
    const date = typeof json === "number" || typeof json === "string" ? new Date(json) : undefined
    if (!date || Number.isNaN(date.getTime())) {
      throw badPayloadError("date", json)
    }
    return date
  },
}

const mapSerializer: ValueSerializer<Map<unknown, unknown>, [JsonValue, JsonValue][]> = {
  tag: "map",

  is(value): value is Map<unknown, unknown> {
    return isMap(value)
  },

  encode(value, ctx) {
    return Array.from(value.entries(), ([k, v], i): [JsonValue, JsonValue] => [
      ctx.encode(k, i),
      ctx.encode(v, i),
    ])
  },

  decode(json, ctx) {
    if (!isArray(json)) {
      throw badPayloadError("map", json)
    }
    const map = new Map<unknown, unknown>()
    json.forEach((entry, i) => {
      if (!isArray(entry) || entry.length !== 2) {
        throw badPayloadError("map", json)
      }
      map.set(ctx.decode(entry[0], i), ctx.decode(entry[1], i))
    })
    return map
  },
}

const setSerializer: ValueSerializer<Set<unknown>, JsonValue[]> = {
  tag: "set",

  is(value): value is Set<unknown> {
    return isSet(value)
  },

  encode(value, ctx) {
    return Array.from(value.values(), (v, i) => ctx.encode(v, i))
  },

  decode(json, ctx) {
    if (!isArray(json)) {
      throw badPayloadError("set", json)
    }
    return new Set(json.map((v, i) => ctx.decode(v, i)))
  },
}

const nonFiniteNumbers: Record<string, number> = {
  NaN: Number.NaN,
  Infinity: Number.POSITIVE_INFINITY,
  "-Infinity": Number.NEGATIVE_INFINITY,
}

const numberSerializer: ValueSerializer<number, string> = {
  tag: "number",

  is(value): value is number {
    return typeof value === "number" && !Number.isFinite(value)
  },

  encode(value) {
    return String(value)
  },

  decode(json) {
    if (typeof json !== "string" || !hasOwnProp(nonFiniteNumbers, json)) {
      throw badPayloadError("number", json)
    }
    return nonFiniteNumbers[json]
  },
}

const bigintSerializer: ValueSerializer<bigint, string> = {
  tag: "bigint",

  is(value): value is bigint {
    return typeof value === "bigint"
  },

  encode(value) {
    return value.toString()
  },

  decode(json) {
    if (typeof json !== "string" || !/^-?\d+$/.test(json)) {
      throw badPayloadError("bigint", json)
    }
    return BigInt(json)
  },
}

const undefinedSerializer: ValueSerializer<undefined, undefined> = {
  tag: "undefined",

  is(value): value is undefined {
    return value === undefined
  },

  encode() {
    return undefined
  },

  decode() {
    return undefined
  },
}

/**
 * The built-in value serializers, appended in this order to every serializer's list (unless it is
 * created with `builtins: false`), except those whose tag a serializer of the list takes. Pick some of them to build a list by hand, e.g.
 * `createSerializer({ serializers: [builtinSerializers.date], builtins: false })`.
 */
export const builtinSerializers = Object.freeze({
  /**
   * Models and frozen data that aren't references, as their snapshots (unmarked, since snapshots
   * mark themselves with `$modelType` / `$frozen`), decoded with `fromSnapshot` into new
   * instances (with new model ids when decoded with `generateNewIds`). Tree arrays and plain
   * objects that aren't references are walked like any other.
   *
   * A custom serializer tagged `snapshot` replaces it: its encoded value must be a snapshot too,
   * and it decodes every value with `$modelType` / `$frozen`.
   */
  snapshot: snapshotSerializer,
  /**
   * Data model instances, as their registered name and their data (encoded, so data of the tree
   * goes as a reference), decoded as a new instance over the decoded data.
   */
  dataModel: dataModelSerializer,
  /**
   * Dates, as `toISOString()` (an invalid date as `null`); decodes an ISO string, a timestamp or
   * `null`.
   */
  date: dateSerializer,
  /**
   * Maps (plain or observable), as an array of `[key, value]` entries; decoded as plain maps.
   */
  map: mapSerializer,
  /**
   * Sets (plain or observable), as an array of their values; decoded as plain sets.
   */
  set: setSerializer,
  /**
   * The numbers JSON can't hold: `"NaN"`, `"Infinity"`, `"-Infinity"`.
   */
  number: numberSerializer,
  /**
   * Bigints, as a decimal string, with no loss of precision.
   */
  bigint: bigintSerializer,
  /**
   * `undefined` (as an array item, an argument or an object property, which keeps its key).
   */
  undefined: undefinedSerializer,
})

/**
 * @internal
 *
 * The only `typeof` of the values each built-in encodes, so encoding can skip the built-ins that
 * can't apply to a value.
 */
export const builtinEncodedTypeof: ReadonlyMap<ValueSerializer, TypeofResult> = new Map<
  ValueSerializer,
  TypeofResult
>([
  [snapshotSerializer, "object"],
  [dataModelSerializer, "object"],
  [dateSerializer, "object"],
  [mapSerializer, "object"],
  [setSerializer, "object"],
  [numberSerializer, "number"],
  [bigintSerializer, "bigint"],
  [undefinedSerializer, "undefined"],
])
