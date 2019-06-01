import { failure } from "../utils"
import { Model } from "./Model"
import { modelInfoByClass, modelInfoByName } from "./modelInfo"

/**
 * Decorator that marks this class (which MUST inherit from the `Model` abstract class)
 * as a model.
 *
 * @param name Unique name for the model type. Note that this name must be unique for your whole
 * application, so it is usually a good idea to use some prefix unique to your application domain.
 */
export const model = (name: string) => (clazz: new (...args: any[]) => Model) => {
  if (typeof clazz !== "function") {
    throw failure("class expected")
  }

  if (!(clazz.prototype instanceof Model)) {
    throw failure(`a model class must extend Model`)
  }

  if (modelInfoByName[name]) {
    throw failure(`a model with name "${name}" already exists`)
  }

  const modelInfo = {
    name,
    class: clazz,
  }

  modelInfoByName[name] = modelInfo
  modelInfoByClass.set(clazz, modelInfo)
}
