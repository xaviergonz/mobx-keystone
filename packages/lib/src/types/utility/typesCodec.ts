import { registerStandardTypeResolver } from "../resolveTypeChecker"
import { typesBigInt } from "./typesBigInt"
import { CodecTypeInfo, typesCodec } from "./typesCodecCore"
import {
  createCodecPropTransform,
  resolveCodecSupport,
  resolveStoredType,
  resolveStoredTypeChecker,
} from "./typesCodecSupport"
import { typesDateAsIsoString, typesDateAsTimestamp } from "./typesDate"
import { typesMapFromArray, typesMapFromObject } from "./typesMap"
import { typesSetFromArray } from "./typesSet"

export {
  CodecTypeInfo,
  createCodecPropTransform,
  resolveCodecSupport,
  resolveStoredType,
  resolveStoredTypeChecker,
  typesBigInt,
  typesCodec,
  typesDateAsIsoString,
  typesDateAsTimestamp,
  typesMapFromArray,
  typesMapFromObject,
  typesSetFromArray,
}

let codecStandardTypeResolversRegistered = false

/**
 * @internal
 */
export function registerCodecStandardTypeResolvers() {
  if (codecStandardTypeResolversRegistered) {
    return
  }
  codecStandardTypeResolversRegistered = true

  registerStandardTypeResolver((value) => (value === BigInt ? typesBigInt : undefined))
}
