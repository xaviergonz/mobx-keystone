import { AnyType } from "../typeChecking"
import { LateTypeChecker, TypeChecker } from "../typeChecking/TypeChecker"
import { logWarning } from "../utils"
import { AnyModel, ModelClass } from "./Model"
import { modelInfoByClass, modelInfoByName } from "./modelInfo"
import { assertIsModelClass } from "./utils"

/**
 * Decorator that marks this class (which MUST inherit from the `Model` abstract class)
 * as a model.
 *
 * @param name Unique name for the model type. Note that this name must be unique for your whole
 * application, so it is usually a good idea to use some prefix unique to your application domain.
 * @param options An optional object with options. The `dataType` option accepts a type to be used
 * for run-time type checking.
 */
export const model = (name: string, options?: { dataType?: AnyType }) => (
  clazz: ModelClass<AnyModel>
) => {
  assertIsModelClass(clazz, "a model class")

  if (modelInfoByName[name]) {
    logWarning(
      "error",
      `a model with name "${name}" already exists (if you are using hot-reloading this might be the cause)`
    )
  }

  let typeChecker: TypeChecker | LateTypeChecker | undefined
  if (options && options.dataType) {
    typeChecker = options.dataType as any
  }

  const modelInfo = {
    name,
    class: clazz,
    dataTypeChecker: typeChecker,
  }

  modelInfoByName[name] = modelInfo
  modelInfoByClass.set(clazz, modelInfo)
}
