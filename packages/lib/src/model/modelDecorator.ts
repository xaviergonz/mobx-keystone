import { HookAction } from "../action/hookActions"
import { wrapModelMethodInActionIfNeeded } from "../action/wrapInAction"
import { addHiddenProp, logWarning } from "../utils"
import { AnyModel, ModelClass, modelInitializedSymbol } from "./BaseModel"
import { modelInfoByClass, modelInfoByName } from "./modelInfo"
import { modelInitializersSymbol } from "./modelSymbols"
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

  // trick so plain new works
  const newClazz: any = function(
    this: any,
    initialData: any,
    snapshotInitialData: any,
    generateNewIds: any
  ) {
    const instance = new (clazz as any)(
      initialData,
      snapshotInitialData,
      this.constructor,
      generateNewIds
    )

    // the object is ready
    addHiddenProp(instance, modelInitializedSymbol, true, false)

    if (instance.onInit) {
      wrapModelMethodInActionIfNeeded(instance, "onInit", HookAction.OnInit)

      instance.onInit()
    }

    return instance
  }
  Object.defineProperty(newClazz, "name", {
    ...Object.getOwnPropertyDescriptor(newClazz, "name"),
    value: clazz.name,
  })
  newClazz.prototype = clazz.prototype
  newClazz[modelInitializersSymbol] = (clazz as any)[modelInitializersSymbol]

  const modelInfo = {
    name,
    class: newClazz,
  }

  modelInfoByName[name] = modelInfo

  modelInfoByClass.set(newClazz, modelInfo)
  modelInfoByClass.set(clazz, modelInfo)

  return newClazz
}
