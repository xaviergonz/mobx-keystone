import { typesArray } from "./array"
import { typesEnum } from "./enum"
import { typesMaybe, typesMaybeNull } from "./maybe"
import { typesModel } from "./model"
import { typesFrozen, typesObject } from "./object"
import { typesObjectMap } from "./objectMap"
import { typesOr } from "./or"
import {
  typesBoolean,
  typesInteger,
  typesLiteral,
  typesNonEmptyString,
  typesNull,
  typesNumber,
  typesString,
  typesUndefined,
} from "./primitives"
import { typesRef } from "./ref"
import { typesRefinement } from "./refinement"
import { typesUnchecked } from "./unchecked"

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
  objectMap: typesObjectMap,
  unchecked: typesUnchecked,
  model: typesModel,
  object: typesObject,
  ref: typesRef,
  frozen: typesFrozen,
  enum: typesEnum,
  refinement: typesRefinement,
  integer: typesInteger,
  nonEmptyString: typesNonEmptyString,
}
