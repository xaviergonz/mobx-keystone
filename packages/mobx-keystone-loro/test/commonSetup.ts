import { configure } from "mobx"
import { ModelAutoTypeCheckingMode, setGlobalConfig } from "mobx-keystone"

configure({
  enforceActions: "never",
})

let nextId = 0
setGlobalConfig({
  modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
  modelIdGenerator() {
    nextId++
    return `id-${nextId}`
  },
})

beforeEach(() => {
  nextId = 0
})
