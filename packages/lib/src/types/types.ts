import { ArrayTypeInfo, typesArray } from "./arrayBased/array"
import { TupleTypeInfo, typesTuple } from "./arrayBased/tuple"
import { ArraySetTypeInfo, typesArraySet } from "./objectBased/arraySet"
import { typesDataModelData } from "./objectBased/dataModelData"
import { ModelTypeInfo, ModelTypeInfoProps, typesModel } from "./objectBased/model"
import {
  FrozenTypeInfo,
  ObjectTypeInfo,
  ObjectTypeInfoProps,
  typesFrozen,
  typesObject,
} from "./objectBased/object"
import { ObjectMapTypeInfo, typesObjectMap } from "./objectBased/objectMap"
import { RecordTypeInfo, typesRecord } from "./objectBased/record"
import { RefTypeInfo, typesRef } from "./objectBased/ref"
import { typesEnum } from "./primitiveBased/enum"
import {
  BigIntTypeInfo,
  BooleanTypeInfo,
  LiteralTypeInfo,
  NumberTypeInfo,
  StringTypeInfo,
  typesBigInt,
  typesBoolean,
  typesLiteral,
  typesNull,
  typesNumber,
  typesString,
  typesUndefined,
} from "./primitiveBased/primitives"
import { typesInteger, typesNonEmptyString } from "./primitiveBased/refinedPrimitives"
import type { AnyType } from "./schemas"
import { typesMaybe, typesMaybeNull } from "./utility/maybe"
import { OrTypeInfo, typesOr } from "./utility/or"
import { RefinementTypeInfo, typesRefinement } from "./utility/refinement"
import { typesUnchecked, UncheckedTypeInfo } from "./utility/unchecked"
export { getTypeInfo } from "./getTypeInfo"
export { TypeInfo } from "./TypeChecker"
export type { ObjectTypeInfoProps, ModelTypeInfoProps }
export {
  BigIntTypeInfo,
  BooleanTypeInfo,
  LiteralTypeInfo,
  NumberTypeInfo,
  StringTypeInfo,
  FrozenTypeInfo,
  ObjectMapTypeInfo,
  RefinementTypeInfo,
  RecordTypeInfo,
  RefTypeInfo,
  UncheckedTypeInfo,
  ObjectTypeInfo,
  ArraySetTypeInfo,
  ArrayTypeInfo,
  ModelTypeInfo,
  OrTypeInfo,
  TupleTypeInfo,
}

export const types = {
  literal: typesLiteral,
  undefined: typesUndefined,
  null: typesNull,
  boolean: typesBoolean,
  number: typesNumber,
  bigint: typesBigInt,
  string: typesString,
  or: typesOr,
  maybe: typesMaybe,
  maybeNull: typesMaybeNull,
  array: typesArray,
  record: typesRecord,
  unchecked: typesUnchecked,
  model: typesModel,
  dataModelData: typesDataModelData,
  object: typesObject,
  ref: typesRef,
  frozen: typesFrozen,
  enum: typesEnum,
  refinement: typesRefinement,
  integer: typesInteger,
  nonEmptyString: typesNonEmptyString,
  objectMap: typesObjectMap,
  arraySet: typesArraySet,
  tuple: typesTuple,

  mapArray<T extends AnyType>(valueType: T) {
    return typesArray(typesTuple(typesString, valueType))
  },
  setArray<T extends AnyType>(valueType: T) {
    return typesArray(valueType)
  },
  mapObject<T extends AnyType>(valueType: T) {
    return typesRecord(valueType)
  },
  dateString: typesNonEmptyString,
  dateTimestamp: typesInteger,
}
