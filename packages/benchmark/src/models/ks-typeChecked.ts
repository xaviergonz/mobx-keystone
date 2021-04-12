import { computed } from "mobx"
import { model, Model, modelAction, tProp, types } from "mobx-keystone"

@model("TcSmallModel")
export class TcSmallModel extends Model({
  a: tProp(types.string, "a"),
  b: tProp(types.string, "b"),
  c: tProp(types.string, "c"),
  d: tProp(types.string, "d"),
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

@model("TcBigModel")
export class TcBigModel extends Model({
  aa: tProp(types.model(TcSmallModel), () => new TcSmallModel({})),
  bb: tProp(types.model(TcSmallModel), () => new TcSmallModel({})),
  cc: tProp(types.model(TcSmallModel), () => new TcSmallModel({})),
  dd: tProp(types.model(TcSmallModel), () => new TcSmallModel({})),
  a: tProp(types.string, "a"),
  b: tProp(types.string, "b"),
  c: tProp(types.string, "c"),
  d: tProp(types.string, "d"),
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
  setAA(s: TcSmallModel) {
    this.aa = s
  }
  @modelAction
  setBB(s: TcSmallModel) {
    this.bb = s
  }
  @modelAction
  setCC(s: TcSmallModel) {
    this.cc = s
  }
  @modelAction
  setDD(s: TcSmallModel) {
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
