import { ArrayTypeInfo, typesArray } from "./arrayBased/typesArray"
import { TupleTypeInfo, typesTuple } from "./arrayBased/typesTuple"
import { ArraySetTypeInfo, typesArraySet } from "./objectBased/typesArraySet"
import { typesDataModelData } from "./objectBased/typesDataModelData"
import { ModelTypeInfo, type ModelTypeInfoProps, typesModel } from "./objectBased/typesModel"
import {
  FrozenTypeInfo,
  ObjectTypeInfo,
  type ObjectTypeInfoProps,
  typesFrozen,
  typesObject,
} from "./objectBased/typesObject"
import { ObjectMapTypeInfo, typesObjectMap } from "./objectBased/typesObjectMap"
import { RecordTypeInfo, typesRecord } from "./objectBased/typesRecord"
import { RefTypeInfo, typesRef } from "./objectBased/typesRef"
import { typesEnum } from "./primitiveBased/typesEnum"
import {
  BooleanTypeInfo,
  LiteralTypeInfo,
  NumberTypeInfo,
  StringTypeInfo,
  typesBoolean,
  typesLiteral,
  typesNull,
  typesNumber,
  typesString,
  typesUndefined,
} from "./primitiveBased/typesPrimitive"
import { typesInteger, typesNonEmptyString } from "./primitiveBased/typesRefinedPrimitive"
import type { AnyType } from "./schemas"
import {
  CodecTypeInfo,
  typesBigInt,
  typesCodec,
  typesDateAsIsoString,
  typesDateAsTimestamp,
  typesMapFromArray,
  typesMapFromObject,
  typesSetFromArray,
} from "./utility/typesCodec"
import { typesMaybe, typesMaybeNull } from "./utility/typesMaybe"
import { OrTypeInfo, typesOr } from "./utility/typesOr"
import { RefinementTypeInfo, typesRefinement } from "./utility/typesRefinement"
import { SkipCheckTypeInfo, typesSkipCheck } from "./utility/typesSkipCheck"
import { TagTypeInfo, typesTag } from "./utility/typesTag"
import { typesUnchecked, UncheckedTypeInfo } from "./utility/typesUnchecked"

export { getTypeInfo } from "./getTypeInfo"
export { TypeInfo } from "./TypeChecker"
export type { ModelTypeInfoProps, ObjectTypeInfoProps }
export {
  ArraySetTypeInfo,
  ArrayTypeInfo,
  BooleanTypeInfo,
  CodecTypeInfo,
  FrozenTypeInfo,
  LiteralTypeInfo,
  ModelTypeInfo,
  NumberTypeInfo,
  ObjectMapTypeInfo,
  ObjectTypeInfo,
  OrTypeInfo,
  RecordTypeInfo,
  RefinementTypeInfo,
  RefTypeInfo,
  SkipCheckTypeInfo,
  StringTypeInfo,
  TagTypeInfo,
  TupleTypeInfo,
  UncheckedTypeInfo,
}

export const types = {
  literal: typesLiteral,
  undefined: typesUndefined,
  null: typesNull,
  boolean: typesBoolean,
  number: typesNumber,
  string: typesString,
  or: typesOr,
  maybe: typesMaybe,
  maybeNull: typesMaybeNull,
  array: typesArray,
  record: typesRecord,
  unchecked: typesUnchecked,
  skipCheck: typesSkipCheck,
  model: typesModel,
  dataModelData: typesDataModelData,
  object: typesObject,
  ref: typesRef,
  frozen: typesFrozen,
  enum: typesEnum,
  tag: typesTag,
  refinement: typesRefinement,
  codec: typesCodec,
  integer: typesInteger,
  nonEmptyString: typesNonEmptyString,
  objectMap: typesObjectMap,
  arraySet: typesArraySet,
  tuple: typesTuple,
  bigint: typesBigInt,
  dateAsTimestamp: typesDateAsTimestamp,
  dateAsIsoString: typesDateAsIsoString,
  /**
   * @deprecated Prefer `types.mapFromArray(...)` for runtime `Map` values.
   */
  mapArray<T extends AnyType>(valueType: T) {
    return typesArray(typesTuple(typesString, valueType))
  },
  /**
   * @deprecated Prefer `types.setFromArray(...)` for runtime `Set` values.
   */
  setArray<T extends AnyType>(valueType: T) {
    return typesArray(valueType)
  },
  /**
   * @deprecated Prefer `types.mapFromObject(...)` for runtime `Map` values.
   */
  mapObject<T extends AnyType>(valueType: T) {
    return typesRecord(valueType)
  },
  mapFromObject<T extends AnyType>(valueType: T) {
    return typesMapFromObject(valueType)
  },
  mapFromArray<TKeyType extends AnyType, TValueType extends AnyType>(
    keyType: TKeyType,
    valueType: TValueType
  ) {
    return typesMapFromArray(keyType, valueType)
  },
  setFromArray<T extends AnyType>(valueType: T) {
    return typesSetFromArray(valueType)
  },
  /**
   * @deprecated Prefer `types.dateAsIsoString` instead.
   */
  dateString: typesNonEmptyString,
  /**
   * @deprecated Prefer `types.dateAsTimestamp` instead.
   */
  dateTimestamp: typesInteger,
}
