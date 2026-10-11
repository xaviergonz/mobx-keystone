import { type CallResolution, resolveCallName } from "../action/resolveCallName"
import { fastGetRootPath, isRoot } from "../parent/path"
import { isTreeNode } from "../tweaker/core"
import { failure, isArray } from "../utils"
import type { Call, ResolvedCall } from "./Call"
import { CallError, CallErrorCode } from "./CallError"
import type { JsonValue } from "./JsonValue"
import { isNodeOfTree } from "./references"

/**
 * @internal
 */
export interface ResolvedCallData {
  readonly resolution: CallResolution
  /**
   * Whether the call has `args`, known without decoding them.
   */
  readonly hasArgs: boolean
}

const resolvedCallData = new WeakMap<object, ResolvedCallData>()

/**
 * @internal
 */
export function getResolvedCallData(call: object): ResolvedCallData | undefined {
  return resolvedCallData.get(call)
}

/**
 * @internal
 */
export function assertIsTreeRoot(root: object): void {
  if (!isTreeNode(root) || !isRoot(root)) {
    throw failure("root must be a tree root")
  }
}

function describeTargetLocation(target: unknown): string {
  if (!isTreeNode(target)) {
    return "it is not a tree node"
  }
  const { path } = fastGetRootPath(target, false)
  return path.length === 0
    ? "it is the root of another tree (or detached)"
    : `it is at path ${JSON.stringify(path)} of another tree`
}

/**
 * @internal
 *
 * Throws `NotFound` unless the call target is a node of the root's tree.
 */
export function assertIsTargetInTree(target: unknown, root: object): asserts target is object {
  if (!isNodeOfTree(target, root)) {
    throw new CallError({
      code: CallErrorCode.NotFound,
      message: `the call target is not a node of the root's tree: ${describeTargetLocation(target)}`,
      path: ["target"],
    })
  }
}

/**
 * @internal
 *
 * Resolves a call's name on its target, throwing `UnknownName` when nothing can be called.
 */
export function resolveCallNameOrThrow(target: object, name: string): CallResolution {
  let resolution: ReturnType<typeof resolveCallName>
  try {
    resolution = resolveCallName(target, name)
  } catch (e) {
    // a data model member on a target that isn't valid data for the data model
    throw new CallError({
      code: CallErrorCode.WrongKind,
      message: `'${name}' cannot be called on the target: its data model can't be created over it`,
      path: ["target"],
      cause: e,
    })
  }
  if (resolution === "hook") {
    throw new CallError({
      code: CallErrorCode.UnknownName,
      message: `calls to hooks (${name}) cannot be applied`,
      path: ["name"],
    })
  }
  if (resolution === "unknown") {
    throw new CallError({
      code: CallErrorCode.UnknownName,
      message: `'${name}' cannot be called on the target: it is not an action or a view`,
      path: ["name"],
    })
  }
  return resolution
}

/**
 * @internal
 *
 * Arguments still to decode: `decode` runs once, when `args` is first read.
 */
export interface EncodedArgs {
  readonly rawArgs: JsonValue[]
  decode(): unknown[]
}

/**
 * @internal
 *
 * Creates a resolved call, with its arguments, or with arguments still to decode.
 */
export function createResolvedCall(
  target: object,
  name: string,
  resolution: CallResolution,
  args: unknown[] | EncodedArgs | undefined
): ResolvedCall {
  const call: { -readonly [K in keyof ResolvedCall]: ResolvedCall[K] } = {
    target,
    name,
    kind: resolution.kind,
    isFlow: resolution.isFlow,
  }

  if (args === undefined || isArray(args)) {
    call.args = args
  } else {
    call.rawArgs = args.rawArgs
    let decodedArgs: unknown[] | undefined
    Object.defineProperty(call, "args", {
      enumerable: true,
      get: () => (decodedArgs ??= args.decode()),
    })
  }

  Object.freeze(call)
  resolvedCallData.set(call, { resolution, hasArgs: args !== undefined })
  return call
}

/**
 * @internal
 *
 * Checks the name and args of a call built in process.
 */
export function assertIsCallShape(call: Call): void {
  if (typeof call.name !== "string") {
    throw failure("call name must be a string")
  }
  if (call.args !== undefined && !isArray(call.args)) {
    throw failure("call args must be an array or undefined")
  }
}

/**
 * @internal
 *
 * Resolves a call built in process (its target must be a node of the tree).
 */
export function toResolvedCall(call: Call): ResolvedCall {
  return createResolvedCall(
    call.target,
    call.name,
    resolveCallNameOrThrow(call.target, call.name),
    call.args
  )
}
