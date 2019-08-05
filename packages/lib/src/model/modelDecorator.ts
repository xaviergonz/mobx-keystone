import { logWarning } from "../utils"
import { AnyModel, ModelClass } from "./BaseModel"
import { modelInfoByClass, modelInfoByName } from "./modelInfo"
import { assertIsModelClass } from "./utils"

/**
 * Decorator that marks this class (which MUST inherit from the `Model` abstract class)
 * as a model.
 *
 * @param name Unique name for the model type. Note that this name must be unique for your whole
 * application, so it is usually a good idea to use some prefix unique to your application domain.
 */
export const model = (name: string) => (clazz: ModelClass<AnyModel>) => {
  assertIsModelClass(clazz, "a model class")

  if (modelInfoByName[name]) {
    logWarning(
      "error",
      `a model with name "${name}" already exists (if you are using hot-reloading this might be the cause)`
    )
  }

  const modelInfo = {
    name,
    class: clazz,
  }

  modelInfoByName[name] = modelInfo
  modelInfoByClass.set(clazz, modelInfo)
}
