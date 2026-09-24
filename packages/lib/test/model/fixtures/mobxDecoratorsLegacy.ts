import * as mobx from "mobx"
import { action, computed, observable } from "mobx"
import { DataModel, ExtendedModel, getMobxVersion, Model, prop } from "../../../src"
import { testModel } from "../../utils"
import { computeCalls } from "./mobxDecoratorsCounter"

@testModel("mobxDecorators/legacy/Base")
export class Base extends Model({ x: prop(1) }) {
  @observable
  flag = false

  @computed
  get double() {
    computeCalls.count++
    return this.x * 2
  }

  @action
  setFlag(flag: boolean) {
    this.flag = flag
  }
}

@testModel("mobxDecorators/legacy/Sub")
export class Sub extends ExtendedModel(Base, {}) {
  @observable
  subFlag = false

  @action
  setSubFlag(subFlag: boolean) {
    this.subFlag = subFlag
  }
}

@testModel("mobxDecorators/legacy/Data")
export class Data extends DataModel({ x: prop<number>() }) {
  @observable
  flag = false

  @computed
  get double() {
    computeCalls.count++
    return this.x * 2
  }

  @action
  setFlag(flag: boolean) {
    this.flag = flag
  }
}

export class Plain {
  constructor() {
    // plain classes need this for MobX 6 legacy decorators, models call it on their own
    if (getMobxVersion() === 6) {
      ;(mobx as any).makeObservable(this)
    }
  }

  @observable
  flag = false

  @computed
  get double() {
    computeCalls.count++
    return 2
  }

  @action
  setFlag(flag: boolean) {
    this.flag = flag
  }
}
