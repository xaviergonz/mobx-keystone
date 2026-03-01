import { isoStringToDateTransform, timestampToDateTransform } from "../../transforms/date"
import { TypeCheckerBaseType } from "../TypeChecker"
import { createCodecType } from "./typesCodecCore"

export const typesDateAsTimestamp = createCodecType(
  {
    typeName: "dateAsTimestamp",
    encodedType: Number,
    is(value): value is Date {
      return value instanceof Date
    },
    ...timestampToDateTransform(),
  },
  TypeCheckerBaseType.Object
)

export const typesDateAsIsoString = createCodecType(
  {
    typeName: "dateAsIsoString",
    encodedType: String,
    is(value): value is Date {
      return value instanceof Date
    },
    ...isoStringToDateTransform(),
  },
  TypeCheckerBaseType.Object
)
