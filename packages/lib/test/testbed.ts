import { computed } from "mobx"
import { model, Model, modelAction, newModel } from "../src"

@model("P2")
export class P2 extends Model<{ y: number }> {
  defaultData = {
    y: 10,
  }
}

@model("P")
export class P extends Model<{ x: number; arr: number[]; p2?: P2 }> {
  defaultData = {
    x: 5,
    arr: [],
  }

  @computed
  get xx() {
    return this.$.x
  }

  get xx2() {
    return this.$.x
  }

  unboundNonAction(): void {}
  boundNonAction: () => void = () => {}

  @modelAction
  unboundAction(): void {}

  @modelAction
  boundAction: () => void = () => {}
}

export function createP(withArray = false) {
  return newModel(P, {
    p2: newModel(P2, {
      y: 12,
    }),
    arr: withArray ? [1, 2, 3] : [],
  })
}
