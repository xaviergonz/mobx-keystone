import { failure } from "../utils"

/**
 * @ignore
 * @internal
 */
export interface ImmutableDate
  extends Omit<
    Date,
    | "setTime"
    | "setMilliseconds"
    | "setUTCMilliseconds"
    | "setSeconds"
    | "setUTCSeconds"
    | "setMinutes"
    | "setUTCMinutes"
    | "setHours"
    | "setUTCHours"
    | "setDate"
    | "setUTCDate"
    | "setMonth"
    | "setUTCMonth"
    | "setFullYear"
    | "setUTCFullYear"
  > {}

const errMessage = "this Date object is immutable"

/**
 * @ignore
 * @internal
 */
export class ImmutableDate extends Date {
  // disable mutable methods

  setTime(): any {
    throw failure(errMessage)
  }

  setMilliseconds(): any {
    throw failure(errMessage)
  }

  setUTCMilliseconds(): any {
    throw failure(errMessage)
  }

  setSeconds(): any {
    throw failure(errMessage)
  }

  setUTCSeconds(): any {
    throw failure(errMessage)
  }

  setMinutes(): any {
    throw failure(errMessage)
  }

  setUTCMinutes(): any {
    throw failure(errMessage)
  }

  setHours(): any {
    throw failure(errMessage)
  }

  setUTCHours(): any {
    throw failure(errMessage)
  }

  setDate(): any {
    throw failure(errMessage)
  }

  setUTCDate(): any {
    throw failure(errMessage)
  }

  setMonth(): any {
    throw failure(errMessage)
  }

  setUTCMonth(): any {
    throw failure(errMessage)
  }

  setFullYear(): any {
    throw failure(errMessage)
  }

  setUTCFullYear(): any {
    throw failure(errMessage)
  }
}
