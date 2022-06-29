import { ArrayTypeInfo, typesArray } from "./arrayBased/typesArray"
import { TupleTypeInfo, typesTuple } from "./arrayBased/typesTuple"
import { ArraySetTypeInfo, typesArraySet } from "./objectBased/typesArraySet"
import { typesDataModelData } from "./objectBased/typesDataModelData"
import { ModelTypeInfo, ModelTypeInfoProps, typesModel } from "./objectBased/typesModel"
import {
  FrozenTypeInfo,
  ObjectTypeInfo,
  ObjectTypeInfoProps,
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
import { typesMaybe, typesMaybeNull } from "./utility/typesMaybe"
import { OrTypeInfo, typesOr } from "./utility/typesOr"
import { RefinementTypeInfo, typesRefinement } from "./utility/typesRefinement"
import { TagTypeInfo, typesTag } from "./utility/typesTag"
import { typesUnchecked, UncheckedTypeInfo } from "./utility/typesUnchecked"
export { getTypeInfo } from "./getTypeInfo"
export { TypeInfo } from "./TypeChecker"
export type { ObjectTypeInfoProps, ModelTypeInfoProps }
export {
  BooleanTypeInfo,
  LiteralTypeInfo,
  NumberTypeInfo,
  StringTypeInfo,
  FrozenTypeInfo,
  ObjectMapTypeInfo,
  TagTypeInfo,
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
  tag: typesTag,
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
