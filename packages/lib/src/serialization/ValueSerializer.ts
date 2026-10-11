import type { PathElement } from "../parent/pathTypes"
import type { JsonValue } from "./JsonValue"

/**
 * The key that marks a special value in the encoded JSON:
 * `{ "$mobxKeystone": <tag>, "v": <payload> }`.
 */
export const serializationMarkerKey = "$mobxKeystone"

/**
 * Context passed to `ValueSerializer.is` and `ValueSerializer.encode`.
 */
export interface EncodeContext {
  /**
   * Root of the tree the value is encoded against.
   */
  readonly root: object

  /**
   * Encodes a nested value with the same serializer.
   *
   * @param value Value to encode.
   * @param key Where the value is inside its parent, for error paths.
   * @returns The encoded value.
   */
  encode(value: unknown, key?: PathElement): JsonValue
}

/**
 * Context passed to `ValueSerializer.decode`.
 */
export interface DecodeContext {
  /**
   * Root of the tree the value is decoded against.
   */
  readonly root: object

  /**
   * Whether models decoded from snapshots must get new model ids (the `generateNewIds` option
   * of the decoding). A serializer that creates models honors it; references ignore it.
   */
  readonly generateNewIds: boolean

  /**
   * Decodes a nested value with the same serializer.
   *
   * @param json Value to decode.
   * @param key Where the value is inside its parent, for error paths.
   * @returns The decoded value.
   */
  decode(json: JsonValue, key?: PathElement): unknown
}

/**
 * Handles one kind of value: encodes it as `{ "$mobxKeystone": tag, "v": payload }` and decodes
 * it back. `createSerializer` composes a list of them into a `Serializer`.
 *
 * @template T Type of the values it handles.
 * @template J Type of the encoded payload (`undefined` to carry none).
 */
export interface ValueSerializer<T = any, J extends JsonValue | undefined = any> {
  /**
   * Unique, e.g. `"geom/Polygon"`; the `$mobxKeystone` of the encoded value.
   */
  readonly tag: string

  /**
   * Whether this serializer encodes `value`.
   *
   * @param value Value to check.
   * @param ctx Encoding context; `ctx.root` is the tree the value is encoded against.
   */
  is(value: unknown, ctx: EncodeContext): value is T

  /**
   * Encodes a value `is` accepted. Use `ctx.encode(child)` for nested values.
   *
   * @param value Value to encode.
   * @param ctx Encoding context.
   * @returns The payload (`v`), or `undefined` to carry none.
   */
  encode(value: T, ctx: EncodeContext): J

  /**
   * Decodes a payload back into a value. Use `ctx.decode(child)` for nested values.
   *
   * @param json The payload (`v`).
   * @param ctx Decoding context.
   * @returns The decoded value.
   */
  decode(json: J, ctx: DecodeContext): T

  /**
   * Only for reference serializers: whether this serializer references `value`, a node of the
   * tree, when it is a call's target. Unlike `is`, it ignores options such as `when`, since the
   * call must run on the node itself. A call's target goes through the first serializer whose
   * `claimsTarget` accepts it (else as a `pathRef`), and only serializers with `claimsTarget`
   * decode it.
   *
   * @param value The call's target.
   * @param ctx Encoding context.
   */
  claimsTarget?(value: object, ctx: EncodeContext): boolean
}
