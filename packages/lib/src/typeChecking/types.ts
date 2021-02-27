import { ArrayTypeInfo, typesArray } from "./array"
import { ArraySetTypeInfo, typesArraySet } from "./arraySet"
import { typesEnum } from "./enum"
import { typesMaybe, typesMaybeNull } from "./maybe"
import { ModelTypeInfo, ModelTypeInfoProps, typesModel } from "./model"
import {
  FrozenTypeInfo,
  ObjectTypeInfo,
  ObjectTypeInfoProps,
  typesFrozen,
  typesObject,
} from "./object"
import { ObjectMapTypeInfo, typesObjectMap } from "./objectMap"
import { OrTypeInfo, typesOr } from "./or"
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
} from "./primitives"
import { RecordTypeInfo, typesRecord } from "./record"
import { RefTypeInfo, typesRef } from "./ref"
import { typesInteger, typesNonEmptyString } from "./refinedPrimitives"
import { RefinementTypeInfo, typesRefinement } from "./refinement"
import type { AnyType } from "./schemas"
import { TupleTypeInfo, typesTuple } from "./tuple"
import { typesUnchecked, UncheckedTypeInfo } from "./unchecked"
export { getTypeInfo } from "./getTypeInfo"
export { TypeInfo } from "./TypeChecker"
export {
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
  ObjectTypeInfoProps,
  ArraySetTypeInfo,
  ArrayTypeInfo,
  ModelTypeInfo,
  ModelTypeInfoProps,
  OrTypeInfo,
  TupleTypeInfo,
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
  model: typesModel,
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
