import { configure } from "mobx"
import { setGlobalConfig } from "../src"

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
