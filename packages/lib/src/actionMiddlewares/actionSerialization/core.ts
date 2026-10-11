/**
 * Returned by an `ActionCallArgumentSerializer` that can't serialize a value.
 *
 * @deprecated Use `ValueSerializer.is` returning false instead.
 */
export const cannotSerialize = Symbol("cannotSerialize")

/**
 * Serializer of action call arguments.
 *
 * @deprecated Use `ValueSerializer` instead.
 */
export interface ActionCallArgumentSerializer<TOriginal, TSerialized> {
  /**
   * Serializer ID, must be unique.
   */
  id: string

  /**
   * Serializes an action call argument, returning `cannotSerialize` if not possible.
   *
   * @param value Value to serialize.
   * @param targetRoot Target root, if provided.
   * @param serializeChild Serialize a child.
   * @returns
   */
  serialize(
    value: unknown,
    serializeChild: (v: unknown) => unknown,
    targetRoot: object | undefined
  ): TSerialized | typeof cannotSerialize

  /**
   * Deserializes an action call argument.
   *
   * @param value Value to deserialize.
   * @param targetRoot Target root, if provided.
   * @param deserializeChild Deserialize a child.
   * @returns
   */
  deserialize(
    value: TSerialized,
    deserializeChild: (v: unknown) => unknown,
    targetRoot: object | undefined
  ): TOriginal
}
