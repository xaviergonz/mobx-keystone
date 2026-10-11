import type { ActionCall } from "../action/applyAction"
import { resolvePathCheckingIds } from "../parent/path"
import { getStandaloneAction } from "../standardActions/actions"
import { failure, hasOwnProp, isArray, isObject, isPlainObject } from "../utils"
import { runWithNewErrorDiagnosticsContext, withErrorPathSegment } from "../utils/errorDiagnostics"
import { builtinSerializers } from "./builtinSerializers"
import type { Call, EncodedCall, ResolvedCall } from "./Call"
import { CallError, CallErrorCode } from "./CallError"
import {
  createDecodeContext,
  createEncodeContext,
  escapedObjectTag,
  groupSerializersByTypeof,
  isUnmarkedSerializer,
  markValue,
  type SerializerConfig,
} from "./codec"
import type { JsonValue } from "./JsonValue"
import { decodePathRef, encodePathRef, pathRefs, pathRefTag } from "./references"
import {
  assertIsCallShape,
  assertIsTargetInTree,
  assertIsTreeRoot,
  createResolvedCall,
  resolveCallNameOrThrow,
} from "./resolvedCall"
import type { DecodeContext, EncodeContext, ValueSerializer } from "./ValueSerializer"
import { serializationMarkerKey } from "./ValueSerializer"

/**
 * Encodes and decodes values and calls against a tree, with a list of value serializers.
 * Created with `createSerializer`.
 *
 * Every operation takes the root of the tree as its first argument; it must be a tree root.
 */
export interface Serializer {
  /**
   * The list of value serializers it was created with, without the built-ins.
   */
  readonly serializers: readonly ValueSerializer[]

  /**
   * Encodes a value as JSON. Nodes of the tree go as references when a reference serializer in
   * the list claims them.
   *
   * @param root Root of the tree.
   * @param value Value to encode.
   * @returns The encoded value.
   */
  encodeValue(root: object, value: unknown): JsonValue

  /**
   * Decodes a value encoded with `encodeValue`. References are resolved against the tree;
   * snapshots become new instances.
   *
   * @param root Root of the tree.
   * @param json Value to decode.
   * @returns The decoded value.
   */
  decodeValue(root: object, json: JsonValue): unknown

  /**
   * Encodes a call (an `ActionCall`, e.g. from `onActionMiddleware`'s `onStart`, or a `Call`)
   * as JSON. The target always goes as a reference; for a standalone action, it isn't repeated
   * in the arguments.
   *
   * Encode an `ActionCall` before the action runs (e.g. in `onStart`), so its arguments are
   * encoded against the tree the receiver has.
   *
   * @param root Root of the tree.
   * @param call The call.
   * @returns The encoded call.
   */
  encodeCall(root: object, call: ActionCall | Call): EncodedCall

  /**
   * Decodes a call encoded with `encodeCall`: the target is resolved and the name resolved on
   * it, nothing is run. The arguments are decoded when `args` is first read.
   *
   * @param root Root of the tree.
   * @param json The encoded call.
   * @returns The resolved call, to pass to `applyCall` or `applyCallAsync`.
   */
  decodeCall(root: object, json: EncodedCall | JsonValue): ResolvedCall
}

/**
 * Options of `createSerializer`.
 */
export interface SerializerOptions {
  /**
   * Value serializers, tried in order before the built-ins when encoding.
   */
  serializers?: readonly ValueSerializer[]
  /**
   * Whether to append the built-in serializers (`builtinSerializers`) to the list.
   * Defaults to `true`.
   */
  builtins?: boolean
}

function assertIsValueSerializer(serializer: unknown, index: number): void {
  if (isObject(serializer) && typeof serializer.encodeValue === "function") {
    throw failure(
      `serializers[${index}] is a serializer; to extend one, spread its '.serializers' into the list`
    )
  }
  if (
    !isObject(serializer) ||
    typeof serializer.tag !== "string" ||
    serializer.tag === "" ||
    typeof serializer.is !== "function" ||
    typeof serializer.encode !== "function" ||
    typeof serializer.decode !== "function" ||
    (serializer.claimsTarget !== undefined && typeof serializer.claimsTarget !== "function")
  ) {
    throw failure(
      `serializers[${index}] must be a value serializer ({ tag, is, encode, decode, claimsTarget? }) with a non-empty tag`
    )
  }
}

function isActionCall(call: ActionCall | Call): call is ActionCall {
  return hasOwnProp(call, "actionName")
}

/**
 * Creates a serializer from a list of value serializers. When encoding, a value goes through the
 * first serializer whose `is` accepts it, then the built-ins (unless `builtins` is `false`),
 * then as plain JSON; decoding picks the serializer by tag.
 *
 * @param options Options.
 * @returns The serializer.
 */
export function createSerializer(options: SerializerOptions = {}): Serializer {
  const custom = options.serializers ? [...options.serializers] : []
  custom.forEach(assertIsValueSerializer)

  const serializers: readonly ValueSerializer[] =
    options.builtins === false
      ? custom
      : [
          ...custom,
          ...Object.values<ValueSerializer>(builtinSerializers).filter((s) => !custom.includes(s)),
        ]

  const byTag = new Map<string, ValueSerializer>()
  for (const serializer of serializers) {
    if (serializer.tag === escapedObjectTag) {
      throw failure(`the tag '${escapedObjectTag}' is reserved`)
    }
    if (byTag.has(serializer.tag)) {
      throw failure(`there is more than one serializer with tag '${serializer.tag}'`)
    }
    byTag.set(serializer.tag, serializer)
  }

  const config: SerializerConfig = {
    serializers,
    byTypeof: groupSerializersByTypeof(serializers),
    byTag,
    unmarked: serializers.find(isUnmarkedSerializer),
  }

  const encodeTarget = (target: unknown, ctx: EncodeContext): JsonValue => {
    assertIsTargetInTree(target, ctx.root)
    // only reference serializers are asked, through `claimsTarget`, which ignores `when` since
    // the call must run on the node itself
    for (const serializer of serializers) {
      if (serializer.claimsTarget?.(target, ctx)) {
        return markValue(serializer.tag, serializer.encode(target, ctx))
      }
    }
    return markValue(pathRefTag, encodePathRef(target))
  }

  const decodeTarget = (json: unknown, ctx: DecodeContext): object => {
    const tag = isPlainObject(json) ? json[serializationMarkerKey] : undefined
    const serializer = typeof tag === "string" ? byTag.get(tag) : undefined

    let target: unknown
    if (tag === pathRefTag && !serializer) {
      // the fallback every serializer decodes in a target position
      target = decodePathRef((json as Record<string, unknown>).v, ctx.root)
    } else if (serializer?.claimsTarget) {
      target = ctx.decode(json as JsonValue)
    } else {
      throw new CallError({
        code: CallErrorCode.BadArgument,
        message: "the call target must be a reference",
        previewValue: json,
      })
    }

    assertIsTargetInTree(target, ctx.root)
    return target
  }

  return {
    serializers: Object.freeze(custom),

    encodeValue(root, value) {
      assertIsTreeRoot(root)
      return runWithNewErrorDiagnosticsContext(() =>
        createEncodeContext(config, root).encode(value)
      )
    },

    decodeValue(root, json) {
      assertIsTreeRoot(root)
      return runWithNewErrorDiagnosticsContext(() => createDecodeContext(config, root).decode(json))
    },

    encodeCall(root, call) {
      assertIsTreeRoot(root)
      if (!isObject(call)) {
        throw failure("call must be an object")
      }

      return runWithNewErrorDiagnosticsContext(() => {
        let target: unknown
        let name: string
        let args: readonly unknown[] | undefined

        if (isActionCall(call)) {
          if (call.serialized) {
            throw failure("cannot encode a serialized action call; deserialize it first")
          }
          const { value, resolved } = resolvePathCheckingIds(
            root,
            call.targetPath,
            call.targetPathIds
          )
          if (!resolved) {
            throw new CallError({
              code: CallErrorCode.NotFound,
              message: `object at path ${JSON.stringify(call.targetPath)} with ids ${JSON.stringify(
                call.targetPathIds
              )} could not be resolved`,
              path: ["target"],
            })
          }
          target = value
          name = call.actionName
          // the target of a standalone action is its first argument, sent once as the target
          args = getStandaloneAction(name) ? call.args.slice(1) : call.args
        } else {
          assertIsCallShape(call)
          target = call.target
          name = call.name
          args = call.args
        }

        const ctx = createEncodeContext(config, root)
        const encoded: EncodedCall = {
          target: withErrorPathSegment("target", () => encodeTarget(target, ctx)),
          name,
        }
        if (args !== undefined) {
          encoded.args = withErrorPathSegment("args", () =>
            Array.from(args, (arg, i) => ctx.encode(arg, i))
          )
        }
        return encoded
      })
    },

    decodeCall(root, json) {
      assertIsTreeRoot(root)

      return runWithNewErrorDiagnosticsContext(() => {
        if (
          !isPlainObject(json) ||
          !hasOwnProp(json, "target") ||
          typeof json.name !== "string" ||
          (json.args !== undefined && !isArray(json.args))
        ) {
          throw new CallError({
            code: CallErrorCode.BadArgument,
            message: "invalid call: expected { target, name, args? }",
            previewValue: json,
          })
        }

        const name = json.name
        const rawArgs = json.args as JsonValue[] | undefined
        const ctx = createDecodeContext(config, root)

        const target = withErrorPathSegment("target", () => decodeTarget(json.target, ctx))
        const resolution = resolveCallNameOrThrow(target, name)

        return createResolvedCall(
          target,
          name,
          resolution,
          rawArgs && {
            rawArgs,
            decode: () =>
              runWithNewErrorDiagnosticsContext(() =>
                withErrorPathSegment("args", () => rawArgs.map((arg, i) => ctx.decode(arg, i)))
              ),
          }
        )
      })
    },
  }
}

/**
 * The default serializer: nodes of the tree as path references (`pathRefs()`, value-type models
 * excepted), plus the built-ins.
 */
export const defaultSerializer: Serializer = createSerializer({ serializers: [pathRefs()] })
