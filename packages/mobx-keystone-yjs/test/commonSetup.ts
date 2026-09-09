import { configure } from "mobx"
import { ModelAutoTypeCheckingMode, setGlobalConfig } from "mobx-keystone"

configure({ enforceActions: "always" })

let id = 1

setGlobalConfig({
  modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
  showDuplicateModelNameWarnings: false,
  modelIdGenerator() {
    return `id-${id++}`
  },
})

beforeEach(() => {
  id = 1
})
