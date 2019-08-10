import { HookAction } from "../action/hookActions"
import { wrapModelMethodInActionIfNeeded } from "../action/wrapInAction"
import { logWarning } from "../utils"
import { AnyModel, ModelClass } from "./BaseModel"
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
  const clazz2 = clazz as any
  const obj = {
    [clazz.name]: class extends clazz2 {
      constructor(initialData: any, snapshotInitialData: any) {
        super(initialData, snapshotInitialData)

        // the object is ready
        if (this.onInit) {
          wrapModelMethodInActionIfNeeded(this as any, "onInit", HookAction.OnInit)

          this.onInit()
        }
      }
    },
  }
  const newClazz: any = obj[clazz.name]
  newClazz[modelInitializersSymbol] = (clazz as any)[modelInitializersSymbol]

  const modelInfo = {
    name,
    class: newClazz,
  }

  modelInfoByName[name] = modelInfo
  modelInfoByClass.set(newClazz, modelInfo)

  return newClazz
}
