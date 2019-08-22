import { computed } from "mobx"
import { model, Model, modelAction, prop } from "mobx-keystone"

@model("SmallModel")
export class SmallModel extends Model({
  a: prop("a"),
  b: prop("b"),
  c: prop("c"),
  d: prop("d"),
}) {
  @computed
  get a2() {
    return this.a + this.a
  }
  @computed
  get b2() {
    return this.b + this.b
  }
  @computed
  get c2() {
    return this.c + this.c
  }
  @computed
  get d2() {
    return this.d + this.d
  }

  @modelAction
  setA(x: string) {
    this.a = x
  }
  @modelAction
  setB(x: string) {
    this.b = x
  }
  @modelAction
  setC(x: string) {
    this.c = x
  }
  @modelAction
  setD(x: string) {
    this.d = x
  }
}

@model("BigModel")
export class BigModel extends Model({
  aa: prop(() => new SmallModel({})),
  bb: prop(() => new SmallModel({})),
  cc: prop(() => new SmallModel({})),
  dd: prop(() => new SmallModel({})),
  a: prop("a"),
  b: prop("b"),
  c: prop("c"),
  d: prop("d"),
}) {
  @computed
  get a2() {
    return this.a + this.a
  }
  @computed
  get b2() {
    return this.b + this.b
  }
  @computed
  get c2() {
    return this.c + this.c
  }
  @computed
  get d2() {
    return this.d + this.d
  }

  @modelAction
  setAA(s: SmallModel) {
    this.aa = s
  }
  @modelAction
  setBB(s: SmallModel) {
    this.bb = s
  }
  @modelAction
  setCC(s: SmallModel) {
    this.cc = s
  }
  @modelAction
  setDD(s: SmallModel) {
    this.dd = s
  }
  @modelAction
  setA(x: string) {
    this.a = x
  }
  @modelAction
  setB(x: string) {
    this.b = x
  }
  @modelAction
  setC(x: string) {
    this.c = x
  }
  @modelAction
  setD(x: string) {
    this.d = x
  }
}
