import type { O } from "ts-toolbelt"
import type { ActionCall } from "../../action/applyAction"
import { assertTweakedObject } from "../../tweaker/core"
import { failure, isJSONPrimitive, isPlainObject } from "../../utils"
import type { JSONPrimitiveValue } from "../../utils/types"
import { arraySerializer } from "./arraySerializer"
import { ActionCallArgumentSerializer, cannotSerialize } from "./core"
import { dateSerializer } from "./dateSerializer"
import { mapSerializer } from "./mapSerializer"
import { objectPathSerializer } from "./objectPathSerializer"
import { objectSnapshotSerializer } from "./objectSnapshotSerializer"
import { plainObjectSerializer } from "./plainObjectSerializer"
import { primitiveSerializer } from "./primitiveSerializer"
import { setSerializer } from "./setSerializer"

const serializersArray: ActionCallArgumentSerializer<any, any>[] = []
const serializersMap = new Map<string, ActionCallArgumentSerializer<any, any>>()

/**
 * Registers a new action call argument serializers.
 * Serializers are called in the inverse order they are registered, meaning the
 * latest one registered will be called first.
 *
 * @param serializer Serializer to register.
 * @returns A disposer to unregister the serializer.
 */
export function registerActionCallArgumentSerializer(
  serializer: ActionCallArgumentSerializer<any, any>
): () => void {
  registerDefaultActionCallArgumentSerializers()

  if (serializersArray.includes(serializer)) {
    throw failure("action call argument serializer already registered")
  }
  if (serializersMap.has(serializer.id)) {
    throw failure(`action call argument serializer with id '${serializer.id}' already registered`)
  }

  serializersArray.unshift(serializer)
  serializersMap.set(serializer.id, serializer)

  return () => {
    const index = serializersArray.indexOf(serializer)
    if (index >= 0) {
      serializersArray.splice(index, 1)
    }
    serializersMap.delete(serializer.id)
  }
}

/**
 * Serialized action call argument.
 */
export interface SerializedActionCallArgument {
  /**
   * Serializer id.
   */
  readonly $mobxKeystoneSerializer: string
  /**
   * Serialized value.
   */
  readonly value: any
}

/**
 * A serialized action call.
 */
export interface SerializedActionCall extends Omit<ActionCall, "serialized"> {
  /**
   * Serialized action arguments.
   */
  readonly args: ReadonlyArray<SerializedActionCallArgument | JSONPrimitiveValue>

  /**
   * Marks this action call as serialized.
   */
  serialized: true
}

/**
 * Transforms an action call argument by returning a `SerializedActionCallArgument`.
 * The following are supported out of the box:
 * - Primitives.
 * - Nodes that are under the same root node as the target root (when provided) will be serialized
 *   as a path.
 * - Nodes that are not under the same root node as the target root will be serialized as their snapshot.
 * - Arrays (observable or not).
 * - Dates.
 * - Maps (observable or not).
 * - Sets (observable or not).
 * - Plain objects (observable or not).
 *
 * If the value cannot be serialized it will throw an exception.
 *
 * @param argValue Argument value to be transformed into its serializable form.
 * @param [targetRoot] Target root node of the model where this action is being performed.
 * @returns The serializable form of the passed value.
 */
export function serializeActionCallArgument(
  argValue: any,
  targetRoot?: object
): SerializedActionCallArgument | JSONPrimitiveValue {
  registerDefaultActionCallArgumentSerializers()

  if (isJSONPrimitive(argValue)) {
    return argValue
  }

  const origValue = argValue

  const serialize = (v: any) => serializeActionCallArgument(v, targetRoot)

  // try serializers
  for (let i = 0; i < serializersArray.length; i++) {
    const serializer = serializersArray[i]
    const serializedValue = serializer.serialize(argValue, serialize, targetRoot)
    if (serializedValue !== cannotSerialize) {
      return {
        $mobxKeystoneSerializer: serializer.id,
        value: serializedValue,
      } as SerializedActionCallArgument
    }
  }

  throw failure(`serializeActionCallArgument could not serialize the given value: ${origValue}`)
}

/**
 * Ensures that an action call is serializable by mapping the action arguments into its
 * serializable version by using `serializeActionCallArgument`.
 *
 * @param actionCall Action call to convert.
 * @param [targetRoot] Target root node of the model where this action is being performed.
 * @returns The serializable action call.
 */
export function serializeActionCall(
  actionCall: ActionCall,
  targetRoot?: object
): SerializedActionCall {
  if (actionCall.serialized) {
    throw failure("cannot serialize an already serialized action call")
  }

  if (targetRoot !== undefined) {
    assertTweakedObject(targetRoot, "targetRoot")
  }

  const serialize = (v: any) => serializeActionCallArgument(v, targetRoot)

  return {
    ...actionCall,
    serialized: true,
    args: actionCall.args.map(serialize),
  }
}

/**
 * Transforms an action call argument by returning its deserialized equivalent.
 *
 * @param argValue Argument value to be transformed into its deserialized form.
 * @param [targetRoot] Target root node of the model where this action is being performed.
 * @returns The deserialized form of the passed value.
 */
export function deserializeActionCallArgument(
  argValue: SerializedActionCallArgument | JSONPrimitiveValue,
  targetRoot?: object
): any {
  registerDefaultActionCallArgumentSerializers()

  if (isJSONPrimitive(argValue)) {
    return argValue
  }

  if (!isPlainObject(argValue) || typeof argValue.$mobxKeystoneSerializer !== "string") {
    throw failure("invalid serialized action call argument")
  }

  const serializerId = argValue.$mobxKeystoneSerializer
  const serializer = serializersMap.get(serializerId)

  if (!serializer) {
    throw failure(`a serializer with id '${serializerId}' could not be found`)
  }

  const serializedValue = argValue as SerializedActionCallArgument

  const deserialize = (v: any) => deserializeActionCallArgument(v, targetRoot)
  return serializer.deserialize(serializedValue.value, deserialize, targetRoot)
}

/**
 * Ensures that an action call is deserialized by mapping the action arguments into its
 * deserialized version by using `deserializeActionCallArgument`.
 *
 * @param actionCall Action call to convert.
 * @param [targetRoot] Target root node of the model where this action is being performed.
 * @returns The deserialized action call.
 */
export function deserializeActionCall(
  actionCall: SerializedActionCall,
  targetRoot?: object
): ActionCall {
  if (!actionCall.serialized) {
    throw failure("cannot deserialize a non-serialized action call")
  }

  if (targetRoot !== undefined) {
    assertTweakedObject(targetRoot, "targetRoot")
  }

  const deserialize = (v: any) => deserializeActionCallArgument(v, targetRoot)
  const deserializedActionCall: ActionCall = {
    ...actionCall,
    serialized: undefined,
    args: actionCall.args.map(deserialize),
  }
  delete (deserializedActionCall as O.Writable<ActionCall>).serialized
  return deserializedActionCall
}

let defaultActionCallArgumentSerializersRegistered = false

function registerDefaultActionCallArgumentSerializers() {
  if (defaultActionCallArgumentSerializersRegistered) {
    return
  }
  defaultActionCallArgumentSerializersRegistered = true

  // serializer registration (from low priority to high priority)

  registerActionCallArgumentSerializer(primitiveSerializer)
  registerActionCallArgumentSerializer(plainObjectSerializer)
  registerActionCallArgumentSerializer(setSerializer)
  registerActionCallArgumentSerializer(mapSerializer)
  registerActionCallArgumentSerializer(dateSerializer)
  registerActionCallArgumentSerializer(arraySerializer)
  registerActionCallArgumentSerializer(objectSnapshotSerializer)
  registerActionCallArgumentSerializer(objectPathSerializer)
}
