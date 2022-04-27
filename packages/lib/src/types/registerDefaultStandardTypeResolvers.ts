import { registerModelStandardTypeResolver } from "./objectBased/model"
import { registerPrimitiveStandardTypeResolvers } from "./primitiveBased/primitives"

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
  registerPrimitiveStandardTypeResolvers()
}
