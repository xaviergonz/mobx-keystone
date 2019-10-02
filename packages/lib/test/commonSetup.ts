import { configure } from "mobx"
import { setGlobalConfig } from "../src"

configure({ enforceActions: "always" })

let id = 1

setGlobalConfig({
  modelIdGenerator() {
    return `id-${id++}`
  },
})
