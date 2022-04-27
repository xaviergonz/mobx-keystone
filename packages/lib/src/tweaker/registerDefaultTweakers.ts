import { registerArrayTweaker } from "./tweakArray"
import { registerFrozenTweaker } from "./tweakFrozen"
import { registerModelTweaker } from "./tweakModel"
import { registerPlainObjectTweaker } from "./tweakPlainObject"

let defaultTweakersRegistered = false

/**
 * @internal
 */
export function registerDefaultTweakers() {
  if (defaultTweakersRegistered) {
    return
  }
  defaultTweakersRegistered = true

  registerArrayTweaker()
  registerFrozenTweaker()
  registerModelTweaker()
  registerPlainObjectTweaker()
}
