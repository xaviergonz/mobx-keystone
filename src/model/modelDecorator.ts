import { ModelClass, Model } from "./Model"
import { modelInfoByName, modelInfoByClass } from "./modelInfo"
import { failure } from "../utils"

export const model = (name: string) => (clazz: ModelClass) => {
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
