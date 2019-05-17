import { ModelClass, Model } from "./Model"
import { modelInfoByName, modelInfoByClass } from "./modelInfo"

export const model = (name: string) => (clazz: ModelClass) => {
  if (typeof clazz !== "function") {
    throw fail("class expected")
  }

  if (!(clazz.prototype instanceof Model)) {
    throw fail(`a model class must extend Model`)
  }

  if (modelInfoByName[name]) {
    throw fail(`a model with name "${name}" already exists`)
  }

  const modelInfo = {
    name,
    class: clazz,
  }

  modelInfoByName[name] = modelInfo
  modelInfoByClass.set(clazz, modelInfo)
}
