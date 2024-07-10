import { types } from "mobx-state-tree"

export const mstSmallModel = types
  .model("SmallModel", {
    a: "a",
    b: "b",
    c: "c",
    d: "d",
  })
  .views((self) => ({
    get a2() {
      return self.a + self.a
    },
    get b2() {
      return self.b + self.b
    },
    get c2() {
      return self.c + self.c
    },
    get D2() {
      return self.d + self.d
    },
  }))
  .actions((self) => ({
    setA(x: string) {
      self.a = x
    },
    setB(x: string) {
      self.b = x
    },
    setC(x: string) {
      self.c = x
    },
    setD(x: string) {
      self.d = x
    },
  }))

export const mstBigModel = types
  .model("BigModel", {
    aa: types.optional(mstSmallModel, () => ({})),
    bb: types.optional(mstSmallModel, () => ({})),
    cc: types.optional(mstSmallModel, () => ({})),
    dd: types.optional(mstSmallModel, () => ({})),
    a: "a",
    b: "b",
    c: "c",
    d: "d",
  })
  .views((self) => ({
    get a2() {
      return self.a + self.a
    },
    get b2() {
      return self.b + self.b
    },
    get c2() {
      return self.c + self.c
    },
    get D2() {
      return self.d + self.d
    },
  }))
  .actions((self) => ({
    setAA(s: any) {
      self.aa = s
    },
    setBB(s: any) {
      self.bb = s
    },
    setCC(s: any) {
      self.cc = s
    },
    setDD(s: any) {
      self.dd = s
    },
    setA(x: string) {
      self.a = x
    },
    setB(x: string) {
      self.b = x
    },
    setC(x: string) {
      self.c = x
    },
    setD(x: string) {
      self.d = x
    },
  }))
