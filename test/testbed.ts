import { computed } from "mobx"
import { model, Model, modelAction, runUnprotected } from "../src"

@model("P2")
export class P2 extends Model {
  data = {
    y: 10,
  }
}

@model("P")
export class P extends Model {
  // these should not get serialized
  protected IAMPROTECTED = 2
  private IAMPRIVATE = -2
  IAMPUBLIC = 5

  // these should get serialized
  data = {
    x: this.IAMPRIVATE + this.IAMPROTECTED + this.IAMPUBLIC,
    arr: [] as number[],
    p2: undefined as P2 | undefined,
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
  const p = new P()
  runUnprotected(() => {
    p.data.p2 = new P2()
    p.data.p2.data.y = 12
    if (withArray) {
      p.data.arr = [1, 2, 3]
    }
  })
  return p
}
