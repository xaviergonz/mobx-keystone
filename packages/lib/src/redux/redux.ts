import { ActionCall, applyAction } from "../action"
import { getSnapshot } from "../snapshot/getSnapshot"
import { onSnapshot, OnSnapshotDisposer, OnSnapshotListener } from "../snapshot/onSnapshot"
import type { SnapshotOutOf } from "../snapshot/SnapshotOf"
import { assertTweakedObject } from "../tweaker/core"
import { failure } from "../utils"

export const reduxActionType = "applyAction"

/**
 * A redux action for mobx-keystone.
 */
export interface ReduxAction {
  readonly type: typeof reduxActionType
  readonly payload: ActionCall
}

/**
 * Transforms an action call into a redux action.
 *
 * @param actionCall Action call.
 * @returns A redux action.
 */
export function actionCallToReduxAction(actionCall: ActionCall): ReduxAction {
  return {
    type: reduxActionType,
    payload: actionCall,
  }
}

/**
 * A redux store for mobx-keystone.
 */
export interface ReduxStore<T> {
  getState(): SnapshotOutOf<T>
  dispatch(action: ReduxAction): ReduxAction
  subscribe(listener: OnSnapshotListener<T>): OnSnapshotDisposer
}

/**
 * A redux runner for mobx-keystone.
 */
export type ReduxRunner<T> = (
  next: ReduxStore<T>["dispatch"]
) => (action: ReduxAction) => ReduxAction

/**
 * A redux middleware for mobx-keystone.
 */
export type ReduxMiddleware<T> = (store: ReduxStore<T>) => ReduxRunner<T>

/**
 * Generates a redux compatible store out of a mobx-keystone object.
 *
 * @template T Object type.
 * @param target Root object.
 * @param middlewares Optional list of redux middlewares.
 * @returns A redux compatible store.
 */
export function asReduxStore<T extends object>(
  target: T,
  ...middlewares: ReduxMiddleware<T>[]
): ReduxStore<T> {
  assertTweakedObject(target, "target")

  const defaultDispatch = (action: ReduxAction) => {
    if (action.type !== reduxActionType) {
      throw failure(
        `action type was expected to be '${reduxActionType}', but it was '${action.type}'`
      )
    }

    applyAction(target, action.payload)
    return action
  }

  const store: ReduxStore<T> = {
    getState() {
      return getSnapshot(target)
    },
    dispatch(action) {
      return runMiddlewares(action, runners, defaultDispatch)
    },
    subscribe(listener) {
      return onSnapshot(target, listener)
    },
  }

  const runners = middlewares.map((mw) => mw(store))

  return store
}

function runMiddlewares<T>(
  initialAction: ReduxAction,
  runners: ReadonlyArray<ReduxRunner<T>>,
  next: ReduxStore<T>["dispatch"]
): ReduxAction {
  let i = 0

  function runNextMiddleware(action: ReduxAction): ReduxAction {
    if (i < runners.length) {
      const runner = runners[i]
      i++
      return runner(runNextMiddleware)(action)
    }
    return next(action)
  }

  return runNextMiddleware(initialAction)
}
