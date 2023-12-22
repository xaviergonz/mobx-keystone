import { configure } from "mobx"
import { setGlobalConfig } from "mobx-keystone"

configure({ enforceActions: "always" })

let id = 1

setGlobalConfig({
  showDuplicateModelNameWarnings: false,
  modelIdGenerator() {
    return `id-${id++}`
  },
})

beforeEach(() => {
  id = 1
})
