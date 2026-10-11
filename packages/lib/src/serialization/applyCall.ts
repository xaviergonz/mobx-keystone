import { transaction } from "mobx"
import { CallKind } from "../action/CallKind"
import { isTreeNode } from "../tweaker/core"
import { failure, hasOwnProp, isObject, isPlainObject } from "../utils"
import type { Call, ResolvedCall } from "./Call"
import { CallError, CallErrorCode } from "./CallError"
import {
  assertIsCallShape,
  assertIsTargetInTree,
  assertIsTreeRoot,
  getResolvedCallData,
  toResolvedCall,
} from "./resolvedCall"
import { serializationMarkerKey } from "./ValueSerializer"

/**
 * Options of `applyCall` and `applyCallAsync`.
 */
export interface ApplyCallOptions {
  /**
   * Decides whether a call may run, after its target and name are resolved and before anything
   * runs. Returning false throws a `CallError` with code `Forbidden`; an error it throws passes
   * through as it is. Reading `call.args` decodes the arguments (once).
   *
   * Defaults to `allowModelActions`.
   */
  canCall?(call: ResolvedCall): boolean
}

/**
 * The default `canCall`: allows model actions (`CallKind.ModelAction`) only.
 *
 * @param call The call.
 * @returns Whether it is a model action.
 */
export function allowModelActions(call: ResolvedCall): boolean {
  return call.kind === CallKind.ModelAction
}

/**
 * A `canCall` that allows every call, for calls from a source that is trusted.
 *
 * @param _call The call.
 * @returns `true`.
 */
export function allowAnyCall(_call: ResolvedCall): boolean {
  return true
}

const kindDescriptions: Record<CallKind, string> = {
  [CallKind.ModelAction]: "a model action",
  [CallKind.StandaloneAction]: "a standalone action",
  [CallKind.StandardAction]: "a standard action",
  [CallKind.BuiltInAction]: "a built-in action",
  [CallKind.View]: "a view",
}

function looksLikeEncodedCall(call: Call): boolean {
  const target: unknown = call.target
  return isPlainObject(target) && hasOwnProp(target, serializationMarkerKey) && !isTreeNode(target)
}

function wrongKind(call: Call, message: string): CallError {
  return new CallError({
    code: CallErrorCode.WrongKind,
    message: `'${call.name}' ${message}`,
    path: ["name"],
  })
}

function isPromiseLike(value: unknown): boolean {
  return (
    (isObject(value) || typeof value === "function") &&
    typeof (value as { then?: unknown }).then === "function"
  )
}

/**
 * Resolves and checks a call, and returns the function that runs it.
 */
function prepareCall(
  root: object,
  call: Call | ResolvedCall,
  options: ApplyCallOptions | undefined,
  allowFlows: boolean
): () => unknown {
  assertIsTreeRoot(root)

  if (!isObject(call)) {
    throw failure("call must be an object")
  }

  const isResolved = getResolvedCallData(call) !== undefined
  if (!isResolved) {
    if (looksLikeEncodedCall(call)) {
      throw failure("this looks like an EncodedCall; decode it first")
    }
    assertIsCallShape(call)
  }

  // also checked for decoded calls, since they could be applied to another tree
  assertIsTargetInTree(call.target, root)

  const resolvedCall = isResolved ? (call as ResolvedCall) : toResolvedCall(call)
  const { resolution, hasArgs } = getResolvedCallData(resolvedCall)!

  if (!allowFlows && resolution.isFlow) {
    throw wrongKind(resolvedCall, "is a flow; use applyCallAsync")
  }

  if (resolution.kind !== CallKind.View) {
    if (!hasArgs) {
      throw wrongKind(resolvedCall, "is an action; pass args")
    }
  } else if (resolution.viewForm === "getter") {
    if (hasArgs) {
      throw wrongKind(resolvedCall, "is a getter; leave args out")
    }
  } else if (!hasArgs) {
    throw wrongKind(resolvedCall, "is a method; pass args")
  }

  const canCall = options?.canCall ?? allowModelActions
  if (!canCall(resolvedCall)) {
    const kindDescription = kindDescriptions[resolution.kind]
    throw new CallError({
      code: CallErrorCode.Forbidden,
      message: options?.canCall
        ? `'${resolvedCall.name}' (${kindDescription}) was refused by canCall`
        : `'${resolvedCall.name}' is ${kindDescription}, which the default canCall refuses; pass canCall to allow it`,
      path: [],
    })
  }

  return () => {
    const args = resolvedCall.args ?? []

    if (resolution.kind !== CallKind.View) {
      return resolution.run(args)
    }

    // one batch, so computeds read by the view stay cached while it runs
    const result = transaction(() => resolution.run(args))
    if (isPromiseLike(result)) {
      throw wrongKind(resolvedCall, "returned a promise; async reads belong in a flow")
    }
    return result
  }
}

/**
 * Runs a call (as returned by `Serializer.decodeCall`, or built in process) on a tree and returns
 * its result as is. Flows are refused (`call.isFlow`); use `applyCallAsync` for them.
 *
 * The call's name is resolved on its target (see `CallKind`), then `canCall` decides whether it
 * may run (by default only model actions may). Errors about the call are `CallError`s; errors
 * thrown by the action or view are rethrown as they are.
 *
 * @template TRet Return type.
 * @param root Root of the tree.
 * @param call The call.
 * @param options Options.
 * @returns The result of the call.
 */
export function applyCall<TRet = unknown>(
  root: object,
  call: Call | ResolvedCall,
  options?: ApplyCallOptions
): TRet {
  return prepareCall(root, call, options, false)() as TRet
}

/**
 * Like `applyCall`, but accepts flows too and always returns a promise, which resolves to the
 * result once the call (or the flow) ends. Every error is a rejection.
 *
 * @template TRet Return type.
 * @param root Root of the tree.
 * @param call The call.
 * @param options Options.
 * @returns A promise of the result of the call.
 */
export async function applyCallAsync<TRet = unknown>(
  root: object,
  call: Call | ResolvedCall,
  options?: ApplyCallOptions
): Promise<TRet> {
  const run = prepareCall(root, call, options, true)
  return (await run()) as TRet
}
