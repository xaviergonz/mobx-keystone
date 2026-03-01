import { stringToBigIntTransform } from "../../transforms/bigint"
import { TypeCheckerBaseType } from "../TypeChecker"
import { createCodecType } from "./typesCodecCore"

export const typesBigInt = createCodecType(
  {
    typeName: "bigint",
    encodedType: String,
    is(value): value is bigint {
      return typeof value === "bigint"
    },
    ...stringToBigIntTransform(),
  },
  TypeCheckerBaseType.Primitive
)
