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
  typesInteger,
  typesLiteral,
  typesNonEmptyString,
  typesNull,
  typesNumber,
  typesString,
  typesUndefined,
} from "./primitives"
import { RecordTypeInfo, typesRecord } from "./record"
import { RefTypeInfo, typesRef } from "./ref"
import { RefinementTypeInfo, typesRefinement } from "./refinement"
import { typesUnchecked, UncheckedTypeInfo } from "./unchecked"
export { getTypeInfo, TypeInfo } from "./TypeChecker"
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
}
