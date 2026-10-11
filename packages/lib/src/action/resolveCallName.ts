import { getDataModelAction } from "../dataModel/actions"
import { BaseDataModel } from "../dataModel/BaseDataModel"
import { isDataModelClass } from "../dataModel/utils"
import { BaseModel } from "../model/BaseModel"
import { isModel } from "../model/utils"
import type { ModelClass } from "../modelShared/BaseModelShared"
import { getModelInfoForName } from "../modelShared/modelInfo"
import { detach } from "../parent/detach"
import { applyPatches } from "../patch/applyPatches"
import { applySnapshot } from "../snapshot/applySnapshot"
import { getStandaloneAction } from "../standardActions/actions"
import { failure, namespace } from "../utils"
import type { AnyFunction } from "../utils/AnyFunction"
import { applyDelete } from "./applyDelete"
import { applyMethodCall } from "./applyMethodCall"
import { applySet } from "./applySet"
import { BuiltInAction, isBuiltInAction } from "./builtInActions"
import { CallKind } from "./CallKind"
import { isHookAction } from "./hookActions"
import { isModelAction } from "./isModelAction"
import { isModelFlow } from "./modelFlow"

const builtInActionToFunction = {
  [BuiltInAction.ApplySnapshot]: applySnapshot,
  [BuiltInAction.ApplyPatches]: applyPatches,
  [BuiltInAction.Detach]: detach,
  [BuiltInAction.ApplySet]: applySet,
  [BuiltInAction.ApplyDelete]: applyDelete,
  [BuiltInAction.ApplyMethodCall]: applyMethodCall,
}

const standardActionPrefixes = [`${namespace}/arrayActions::`, `${namespace}/objectActions::`]

const dataModelMemberPrefix = "fn::"

// members that are never callable, even when defined below the base classes
const nonCallableMemberNames: ReadonlySet<string> = new Set([
  "constructor",
  "onInit",
  "onLazyInit",
  "onAttachedToRootStore",
  "onLazyAttachedToRootStore",
])

/**
 * @internal
 *
 * How a view is used: a getter is read (no `args`), a method is called (with `args`).
 */
export type ViewForm = "getter" | "method"

/**
 * @internal
 *
 * What a call's name resolved to on its target.
 */
export interface CallResolution {
  readonly kind: CallKind
  readonly isFlow: boolean
  /**
   * Only for views.
   */
  readonly viewForm: ViewForm | undefined
  /**
   * Runs the call on the target it was resolved for (args are ignored when reading a getter).
   */
  run(args: readonly unknown[]): unknown
}

/**
 * @internal
 *
 * Why a name couldn't be resolved: a hook (never callable) or nothing callable by that name.
 */
export type CallResolutionFailure = "hook" | "unknown"

type FoundMember = { readonly get: AnyFunction } | { readonly fn: AnyFunction }

/**
 * Finds a callable member without running any getter: a method, getter or function field of the
 * object or of its prototype chain below `stopProto`.
 */
function findMember(obj: object, name: string, stopProto: object): FoundMember | undefined {
  if (nonCallableMemberNames.has(name)) {
    return undefined
  }

  // own accessors too, e.g. computeds MobX defines on the instance with legacy decorators
  for (
    let current: object | null = obj;
    current && current !== stopProto;
    current = Object.getPrototypeOf(current)
  ) {
    const desc = Object.getOwnPropertyDescriptor(current, name)
    if (desc) {
      if (desc.get) {
        return { get: desc.get }
      }
      return typeof desc.value === "function" ? { fn: desc.value } : undefined
    }
  }
  return undefined
}

function resolveMember(member: FoundMember, self: object): CallResolution {
  if ("get" in member) {
    const get = member.get
    return {
      kind: CallKind.View,
      isFlow: false,
      viewForm: "getter",
      run: () => get.call(self),
    }
  }

  const fn = member.fn
  const run = (args: readonly unknown[]) => fn.apply(self, args as unknown[])
  if (isModelAction(fn) || isModelFlow(fn)) {
    return { kind: CallKind.ModelAction, isFlow: isModelFlow(fn), viewForm: undefined, run }
  }
  return { kind: CallKind.View, isFlow: false, viewForm: "method", run }
}

function getDataModelClassAndMember(
  name: string
): { modelClass: ModelClass<any>; memberName: string } | undefined {
  // data model actions are registered under their name
  const registered = getDataModelAction(name)
  if (registered) {
    return { modelClass: registered.modelClass, memberName: registered.fnName }
  }

  // other members are named the same way: fn::<data model name>::<member>
  if (!name.startsWith(dataModelMemberPrefix)) {
    return undefined
  }
  const separatorIndex = name.lastIndexOf("::")
  if (separatorIndex < dataModelMemberPrefix.length) {
    return undefined
  }
  const modelInfo = getModelInfoForName(name.slice(dataModelMemberPrefix.length, separatorIndex))
  if (!modelInfo || !isDataModelClass(modelInfo.class)) {
    return undefined
  }
  return { modelClass: modelInfo.class, memberName: name.slice(separatorIndex + 2) }
}

/**
 * @internal
 *
 * Resolves what a call's name refers to on its target, in this order: built-in actions, hooks
 * (refused), data model members, standalone actions, the target's own model actions and flows,
 * and finally the target's own methods, getters and function fields (views).
 *
 * Getters are never run while resolving.
 */
export function resolveCallName(
  target: object,
  name: string
): CallResolution | CallResolutionFailure {
  if (isBuiltInAction(name)) {
    const fn = builtInActionToFunction[name] as AnyFunction | undefined
    if (!fn) {
      throw failure(`assertion failed: unknown built-in action - ${name}`)
    }
    return {
      kind: CallKind.BuiltInAction,
      isFlow: false,
      viewForm: undefined,
      run: (args) => fn.apply(target, [target, ...args]),
    }
  }

  if (isHookAction(name)) {
    return "hook"
  }

  const dataModelMember = getDataModelClassAndMember(name)
  if (dataModelMember) {
    // the instance is created (or reused, since they are cached) first, so decorators that
    // initialize on first use have run; it throws when the target isn't valid data for the class
    const instance: object = new dataModelMember.modelClass(target)
    const member = findMember(instance, dataModelMember.memberName, BaseDataModel.prototype)
    return member ? resolveMember(member, instance) : "unknown"
  }

  const standaloneAction = getStandaloneAction(name)
  if (standaloneAction) {
    return {
      kind: standardActionPrefixes.some((prefix) => name.startsWith(prefix))
        ? CallKind.StandardAction
        : CallKind.StandaloneAction,
      isFlow: standaloneAction.isFlow,
      viewForm: undefined,
      run: (args) => standaloneAction.fn(target, ...args),
    }
  }

  if (isModel(target)) {
    const member = findMember(target, name, BaseModel.prototype)
    if (member) {
      return resolveMember(member, target)
    }
  }

  return "unknown"
}
