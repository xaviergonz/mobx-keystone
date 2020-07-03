import { configure, getConfig } from "../../src"

test("configure", () => {
  expect(getConfig()).toEqual({ allowArrayElementUndefined: false })
  configure({ allowArrayElementUndefined: true })
  expect(getConfig()).toEqual({ allowArrayElementUndefined: true })
  configure({})
  expect(getConfig()).toEqual({ allowArrayElementUndefined: true })
  configure({ allowArrayElementUndefined: undefined })
  expect(getConfig()).toEqual({ allowArrayElementUndefined: true })
})
