import type { Path } from "../parent/pathTypes"
import { MobxKeystoneError } from "../utils"
import {
  buildErrorMessageWithDiagnostics,
  getErrorPathSnapshot,
  noErrorValuePreview,
} from "../utils/errorDiagnostics"

/**
 * The reason a call failed.
 */
export enum CallErrorCode {
  /**
   * The target, or a reference in the arguments, doesn't resolve.
   */
  NotFound = "notFound",
  /**
   * Nothing by that name can be called on the target.
   */
  UnknownName = "unknownName",
  /**
   * The name exists, but can't be used as asked (e.g. a method read without `args`).
   */
  WrongKind = "wrongKind",
  /**
   * Refused by `canCall`.
   */
  Forbidden = "forbidden",
  /**
   * An argument (or any other value being decoded) failed to decode.
   */
  BadArgument = "badArgument",
  /**
   * A value (usually the result) can't be encoded.
   */
  CannotEncode = "cannotEncode",
}

/**
 * What a `CallError` is built from, e.g. by a custom `ValueSerializer` that wants to choose the
 * code (a `CallError` it throws passes through as it is; any other error is wrapped).
 */
export interface CallErrorData {
  /**
   * The reason.
   */
  code: CallErrorCode
  /**
   * The message, without the path and value preview the error adds to it.
   */
  message: string
  /**
   * Path relative to the call or value, e.g. `["args", 1, "items", 3]`.
   * Defaults to where the value being encoded or decoded is.
   */
  path?: Path
  /**
   * The value the error is about, shown in the message.
   */
  previewValue?: unknown
  /**
   * The error that caused it, if any. Its message is added to `message`, but left out of
   * `toJSON()`, since it may hold the server's data.
   */
  cause?: unknown
}

/**
 * The JSON form of a `CallError`, safe to send back to the caller.
 */
export interface CallErrorJson {
  code: CallErrorCode
  message: string
  path: Path
}

/**
 * Thrown when a call or a value can't be decoded, resolved, allowed, run or encoded
 * (extends `MobxKeystoneError`). Errors thrown by the action or view being called are not
 * `CallError`s: they are rethrown as they are.
 *
 * Use `instanceof CallError` to distinguish call errors from other
 * `MobxKeystoneError` instances.
 */
export class CallError extends MobxKeystoneError {
  /**
   * The reason.
   */
  readonly code: CallErrorCode
  /**
   * Where in the call or value the error is, e.g. `["args", 1]`.
   */
  readonly path: Path
  /**
   * The error that caused it, if any.
   */
  readonly cause?: unknown

  private readonly jsonMessage: string

  constructor(data: CallErrorData) {
    const path = data.path ?? getErrorPathSnapshot() ?? []
    const previewValue = "previewValue" in data ? data.previewValue : noErrorValuePreview
    const causeMessage =
      data.cause === undefined
        ? undefined
        : data.cause instanceof Error
          ? data.cause.message
          : String(data.cause)

    super(
      buildErrorMessageWithDiagnostics({
        message: causeMessage === undefined ? data.message : `${data.message}: ${causeMessage}`,
        path,
        previewValue,
      })
    )

    this.code = data.code
    this.path = path
    this.cause = data.cause
    // a CannotEncode value is the server's, and so may be a cause's message
    this.jsonMessage =
      data.code === CallErrorCode.CannotEncode
        ? data.message
        : causeMessage === undefined
          ? this.message
          : buildErrorMessageWithDiagnostics({ message: data.message, path, previewValue })
  }

  /**
   * The error as JSON, for RPC and tool layers. It leaves out the cause's message, and the value
   * preview of a `CannotEncode` error, since they may hold the server's data.
   */
  toJSON(): CallErrorJson {
    return {
      code: this.code,
      message: this.jsonMessage,
      path: this.path,
    }
  }
}

/**
 * @internal
 */
export function badPayloadError(tag: string, json: unknown): CallError {
  return new CallError({
    code: CallErrorCode.BadArgument,
    message: `invalid '${tag}' value`,
    previewValue: json,
  })
}
