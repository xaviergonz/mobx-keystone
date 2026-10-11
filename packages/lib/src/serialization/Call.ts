import type { CallKind } from "../action/CallKind"
import type { JsonValue } from "./JsonValue"

/**
 * A call as JSON, as `Serializer.encodeCall` returns it and `Serializer.decodeCall` takes it.
 */
export interface EncodedCall {
  /**
   * A reference to the node the call runs on; for a standalone action, its first argument.
   */
  target: JsonValue
  /**
   * Name of the action or view.
   */
  name: string
  /**
   * Encoded arguments; left out to read a getter.
   */
  args?: JsonValue[]
}

/**
 * A call to an action or a view of a node.
 */
export interface Call {
  /**
   * The node the call runs on; for a standalone action, its first argument.
   */
  target: object
  /**
   * Name of the action or view.
   */
  name: string
  /**
   * Arguments (for a standalone action, without the target); left out to read a getter.
   */
  args?: unknown[]
}

/**
 * A call whose target and name are resolved, as `Serializer.decodeCall` returns it and `canCall`
 * gets it.
 */
export interface ResolvedCall extends Readonly<Call> {
  /**
   * What `name` resolved to on the target.
   */
  readonly kind: CallKind
  /**
   * Whether it is a `@modelFlow` or a `standaloneFlow`, which needs `applyCallAsync`.
   */
  readonly isFlow: boolean
  /**
   * The arguments as JSON, only on a call returned by `decodeCall`. Reading `args` decodes them
   * (once).
   */
  readonly rawArgs?: JsonValue[]
}
