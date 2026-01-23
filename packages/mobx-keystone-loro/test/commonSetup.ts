import { configure } from "mobx"
import { setGlobalConfig } from "mobx-keystone"

configure({
  enforceActions: "never",
})

let nextId = 0
setGlobalConfig({
  modelIdGenerator() {
    nextId++
    return `id-${nextId}`
  },
})

beforeEach(() => {
  nextId = 0
})
