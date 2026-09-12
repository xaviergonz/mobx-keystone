import { MobxKeystoneAggregateError } from "./index"

/**
 * A failure kept aside while the rest of a delivery runs. It is boxed so that a thrown
 * `undefined` / `null` can still be rethrown as is, and holds a `MobxKeystoneAggregateError`
 * once more than one callback of the same delivery has failed.
 * @internal
 */
export type DelayedError =
  | { value: unknown; aggregateErrors?: undefined }
  | { value: MobxKeystoneAggregateError; aggregateErrors: unknown[] }
  | undefined

/**
 * Adds a failure to the ones already kept aside for the same delivery: a lone failure is kept
 * as is, several are grouped in a `MobxKeystoneAggregateError`. Nested delivery is flattened,
 * so `errors` is always a flat list of callback failures. The accumulator is updated in place.
 * @internal
 */
export function addDelayedError(
  current: DelayedError,
  error: unknown,
  msg = "multiple callbacks failed"
): DelayedError {
  if (!current) {
    return { value: error }
  }

  let errors = current.aggregateErrors
  if (!errors) {
    // Start from a copy: an aggregate thrown by a callback is not ours to mutate.
    errors = flattenDelayedError(current.value)
    current = { value: new MobxKeystoneAggregateError(errors, msg), aggregateErrors: errors }
  }

  pushDelayedError(errors, error)
  return current
}

/**
 * Reports the failures kept aside for a delivery, if there were any.
 * @internal
 */
export function throwDelayedError(delayedError: DelayedError): void {
  if (delayedError) {
    throw delayedError.value
  }
}

/**
 * Runs every callback, then reports the failures (if any) once delivery has finished.
 * Iterates the collection directly, so appended array items are also visited.
 * @internal
 */
export function forEachWithDelayedThrow<T>(items: Iterable<T>, fn: (item: T) => void): void {
  let delayedError: DelayedError
  for (const item of items) {
    try {
      fn(item)
    } catch (error) {
      delayedError = addDelayedError(delayedError, error)
    }
  }
  throwDelayedError(delayedError)
}

/** @internal */
export function flattenDelayedError(error: unknown): unknown[] {
  return error instanceof MobxKeystoneAggregateError ? [...error.errors] : [error]
}

/** @internal */
export function pushDelayedError(errors: unknown[], error: unknown): void {
  if (error instanceof MobxKeystoneAggregateError) {
    const nestedErrors = error.errors
    const length = nestedErrors.length
    for (let i = 0; i < length; i++) {
      errors.push(nestedErrors[i])
    }
  } else {
    errors.push(error)
  }
}
