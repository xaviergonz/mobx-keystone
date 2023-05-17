import { computed } from "mobx"
import { idProp, model, Model, modelAction, modelIdKey, prop } from "../src"

@model("P2")
export class P2 extends Model({
  [modelIdKey]: idProp,
  y: prop(() => 10),
}) {}

@model("P")
export class P extends Model({
  [modelIdKey]: idProp,
  x: prop(() => 5),
  arr: prop<number[]>(() => []),
  p2: prop<P2 | undefined>().withSetter(),
}) {
  @computed
  get xx() {
    return this.x
  }

  get xx2() {
    return this.x
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
