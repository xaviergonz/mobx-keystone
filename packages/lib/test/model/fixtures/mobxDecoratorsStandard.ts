import { action, computed, observable } from "mobx"
import { DataModel, ExtendedModel, Model, prop } from "../../../src"
import { testModel } from "../../utils"
import { computeCalls } from "./mobxDecoratorsCounter"

@testModel("mobxDecorators/standard/Base")
export class Base extends Model({ x: prop(1) }) {
  @observable
  accessor flag = false

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

@testModel("mobxDecorators/standard/Sub")
export class Sub extends ExtendedModel(Base, {}) {
  @observable
  accessor subFlag = false

  @action
  setSubFlag(subFlag: boolean) {
    this.subFlag = subFlag
  }
}

@testModel("mobxDecorators/standard/Data")
export class Data extends DataModel({ x: prop<number>() }) {
  @observable
  accessor flag = false

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
  @observable
  accessor flag = false

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
