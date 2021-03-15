import { setDataModelAction } from "../dataModel/actions"
import { isDataModel, isDataModelClass } from "../dataModel/utils"
import { modelInfoByClass } from "../modelShared/modelInfo"
import { runAfterModelDecoratorSymbol } from "../modelShared/modelSymbols"
import { addLateInitializationFunction } from "../utils"
import { WrapInActionOverrideContextFn } from "./wrapInAction"

export function getActionNameAndContextOverride(
  target: any,
  propertyKey: string
): {
  actionName: string | (() => string)
  overrideContext: WrapInActionOverrideContextFn | undefined
} {
  let actionName: string | (() => string) = propertyKey
  let overrideContext: WrapInActionOverrideContextFn | undefined

  if (isDataModelClass(target) || isDataModel(target)) {
    overrideContext = (ctx, self) => {
      ctx.target = self.$
    }

    let fullActionName: string
    actionName = () => fullActionName

    const modelClass: any = isDataModelClass(target) ? target : target.constructor

    addLateInitializationFunction(modelClass, runAfterModelDecoratorSymbol, (finalClass) => {
      const modelInfo = modelInfoByClass.get(finalClass)!
      fullActionName = `fn::${modelInfo.name}::${propertyKey}`
      setDataModelAction(fullActionName, modelInfo.class, propertyKey)
    })
  }
  return { actionName, overrideContext }
}
