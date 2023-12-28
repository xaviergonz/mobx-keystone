import { registerDataModelDataStandardTypeResolver } from "./objectBased/typesDataModelData"
import { registerModelStandardTypeResolver } from "./objectBased/typesModel"
import { registerPrimitiveStandardTypeResolvers } from "./primitiveBased/typesPrimitive"

let defaultStandardTypeResolversRegistered = false

/**
 * @internal
 */
export function registerDefaultStandardTypeResolvers() {
  if (defaultStandardTypeResolversRegistered) {
    return
  }
  defaultStandardTypeResolversRegistered = true

  registerModelStandardTypeResolver()
  registerDataModelDataStandardTypeResolver()
  registerPrimitiveStandardTypeResolvers()
}
