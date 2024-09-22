import { ActionContextActionType } from "../action"
import {
  actionTrackingMiddleware,
  ActionTrackingResult,
  SimpleActionContext,
} from "../actionMiddlewares"
import { fastGetRootPath, RootPath } from "../parent/path"
import { applySnapshot } from "../snapshot/applySnapshot"
import { getSnapshot } from "../snapshot/getSnapshot"
import { assertTweakedObject } from "../tweaker/core"

/**
 * Connects a tree node to a redux dev tools instance.
 *
 * @param remotedevPackage The remotedev package (usually the result of `require("remoteDev")`) (https://www.npmjs.com/package/remotedev).
 * @param remotedevConnection The result of a connect method from the remotedev package (usually the result of `remoteDev.connectViaExtension(...)`).
 * @param target Object to use as root.
 * @param storeName Name to be shown in the redux dev tools.
 * @param [options] Optional options object. `logArgsNearName` if it should show the arguments near the action name (default is `true`).
 */
export function connectReduxDevTools(
  remotedevPackage: any,
  remotedevConnection: any,
  target: object,
  options?: {
    logArgsNearName?: boolean
  }
) {
  assertTweakedObject(target, "target")

  const opts = {
    logArgsNearName: true,
    ...options,
  }

  let handlingMonitorAction = 0

  // subscribe to change state (if need more than just logging)
  remotedevConnection.subscribe((message: any) => {
    if (message.type === "DISPATCH") {
      handleMonitorActions(remotedevConnection, target, message)
    }
  })

  const initialState = getSnapshot(target)
  remotedevConnection.init(initialState)

  let currentActionId = 0
  const actionIdSymbol = Symbol("actionId")

  actionTrackingMiddleware(target, {
    onStart(ctx) {
      ctx.data[actionIdSymbol] = currentActionId++
    },
    onResume(ctx) {
      // give a chance to the parent to log its own changes before the child starts
      if (ctx.parentContext) {
        log(ctx.parentContext, undefined)
      }
      log(ctx, undefined)
    },
    onSuspend(ctx) {
      log(ctx, undefined)
    },
    onFinish(ctx, ret) {
      log(ctx, ret.result)
    },
  })

  function handleMonitorActions(remotedev2: any, target2: any, message: any) {
    try {
      handlingMonitorAction++

      switch (message.payload.type) {
        case "RESET": {
          applySnapshot(target2, initialState)
          return remotedev2.init(initialState)
        }

        case "COMMIT":
          return remotedev2.init(getSnapshot(target2))

        case "ROLLBACK":
          return remotedev2.init(remotedevPackage.extractState(message))

        case "JUMP_TO_STATE":
        case "JUMP_TO_ACTION": {
          applySnapshot(target2, remotedevPackage.extractState(message))
          return
        }

        case "IMPORT_STATE": {
          const nextLiftedState = message.payload.nextLiftedState
          const computedStates = nextLiftedState.computedStates
          applySnapshot(target2, computedStates[computedStates.length - 1].state)
          remotedev2.send(null, nextLiftedState)
          return
        }

        default:
      }
    } finally {
      handlingMonitorAction--
    }
  }

  let lastLoggedSnapshot = initialState

  function log(ctx: SimpleActionContext, result: ActionTrackingResult | undefined) {
    if (handlingMonitorAction) {
      return
    }

    const sn = getSnapshot(target)

    // ignore actions that don't change anything (unless it is a throw)
    if (sn === lastLoggedSnapshot && result !== ActionTrackingResult.Throw) {
      return
    }
    lastLoggedSnapshot = sn

    const rootPath = fastGetRootPath(ctx.target, false)
    const name = getActionContextNameAndTypePath(ctx, rootPath, result)

    const copy = {
      type: name,
      path: rootPath.path,
      args: ctx.args,
    }

    remotedevConnection.send(copy, sn)
  }

  function getActionContextNameAndTypePath(
    ctx: SimpleActionContext,
    rootPath: RootPath<any>,
    result: ActionTrackingResult | undefined
  ) {
    const pathStr = "[/" + rootPath.path.join("/") + "] "
    let name = pathStr + ctx.actionName

    if (opts.logArgsNearName) {
      let args = ctx.args
        .map((a) => {
          try {
            return JSON.stringify(a)
          } catch {
            return "**unserializable**"
          }
        })
        .join(", ")

      if (args.length > 64) {
        args = args.slice(0, 64) + "..."
      }

      name += `(${args})`
    }

    const actionId = ctx.data[actionIdSymbol]

    name += ` (id ${actionId !== undefined ? actionId : "?"}`
    if (ctx.type === ActionContextActionType.Async) {
      name += ", async"
    }
    name += ")"

    if (result === ActionTrackingResult.Throw) {
      name += " -error thrown-"
    }

    if (ctx.parentContext) {
      const parentName = getActionContextNameAndTypePath(
        ctx.parentContext,
        fastGetRootPath(ctx.parentContext.target, false),
        undefined
      )
      if (parentName) {
        name = `${parentName} >>> ${name}`
      }
    }

    return name
  }
}
