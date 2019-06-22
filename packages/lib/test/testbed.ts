import { computed } from "mobx"
import { model, Model, modelAction } from "../src"

@model("P2")
export class P2 extends Model<{}, { y: number }> {
  getDefaultData() {
    return {
      y: 10,
    }
  }
}

@model("P")
export class P extends Model<{}, { x: number; arr: number[]; p2?: P2 }> {
  // these should get serialized
  getDefaultData() {
    return {
      x: 5,
      arr: [],
      p2: undefined,
    }
  }

  // these should not get serialized

  @computed
  get xx() {
    return this.data.x
  }

  get xx2() {
    return this.data.x
  }

  unboundNonAction(): void {}
  boundNonAction: () => void = () => {}

  @modelAction
  unboundAction(): void {}

  @modelAction
  boundAction: () => void = () => {}
}

export function createP(withArray = false) {
  return new P({
    p2: new P2({
      y: 12,
    }),
    arr: withArray ? [1, 2, 3] : [],
  })
}
