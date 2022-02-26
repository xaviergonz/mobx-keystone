import { action, computed, makeObservable, observable } from "mobx"
export interface SmallModelSnapshot {
  a?: string
  b?: string
  c?: string
  d?: string
}

export class MobxSmallModel {
  a: string
  b: string
  c: string
  d: string

  static fromSnapshot(snapshot: SmallModelSnapshot) {
    return new MobxSmallModel(snapshot)
  }

  constructor(props?: SmallModelSnapshot) {
    makeObservable(this, {
      a: observable,
      b: observable,
      c: observable,
      d: observable,
      a2: computed,
      b2: computed,
      c2: computed,
      d2: computed,
      setA: action,
      setB: action,
      setC: action,
      setD: action,
    })

    this.a = props?.a ?? "a"
    this.b = props?.b ?? "b"
    this.c = props?.c ?? "c"
    this.d = props?.d ?? "d"
  }

  get a2() {
    return this.a + this.a
  }
  get b2() {
    return this.b + this.b
  }
  get c2() {
    return this.c + this.c
  }
  get d2() {
    return this.d + this.d
  }

  setA(x: string) {
    this.a = x
  }
  setB(x: string) {
    this.b = x
  }
  setC(x: string) {
    this.c = x
  }
  setD(x: string) {
    this.d = x
  }
}

export class MobxBigModel {
  a: string
  b: string
  c: string
  d: string
  aa: MobxSmallModel
  bb: MobxSmallModel
  cc: MobxSmallModel
  dd: MobxSmallModel

  static fromSnapshot(snapshot: {
    a?: string
    b?: string
    c?: string
    d?: string
    aa?: SmallModelSnapshot
    bb?: SmallModelSnapshot
    cc?: SmallModelSnapshot
    dd?: SmallModelSnapshot
  }) {
    return new MobxBigModel({
      ...snapshot,
      aa: snapshot.aa ? MobxSmallModel.fromSnapshot(snapshot.aa) : undefined,
      bb: snapshot.bb ? MobxSmallModel.fromSnapshot(snapshot.bb) : undefined,
      cc: snapshot.cc ? MobxSmallModel.fromSnapshot(snapshot.cc) : undefined,
      dd: snapshot.dd ? MobxSmallModel.fromSnapshot(snapshot.dd) : undefined,
    })
  }

  constructor(props: {
    a?: string
    b?: string
    c?: string
    d?: string
    aa?: MobxSmallModel
    bb?: MobxSmallModel
    cc?: MobxSmallModel
    dd?: MobxSmallModel
  }) {
    makeObservable(this, {
      a: observable,
      b: observable,
      c: observable,
      d: observable,
      aa: observable,
      bb: observable,
      cc: observable,
      dd: observable,
      a2: computed,
      b2: computed,
      c2: computed,
      d2: computed,
      setA: action,
      setB: action,
      setC: action,
      setD: action,
      setAA: action,
      setBB: action,
      setCC: action,
      setDD: action,
    })

    this.a = props?.a ?? "a"
    this.b = props?.b ?? "b"
    this.c = props?.c ?? "c"
    this.d = props?.d ?? "d"
    this.aa = props?.aa ?? new MobxSmallModel()
    this.bb = props?.bb ?? new MobxSmallModel()
    this.cc = props?.cc ?? new MobxSmallModel()
    this.dd = props?.dd ?? new MobxSmallModel()
  }

  get a2() {
    return this.a + this.a
  }
  get b2() {
    return this.b + this.b
  }
  get c2() {
    return this.c + this.c
  }
  get d2() {
    return this.d + this.d
  }

  setAA(s: MobxSmallModel) {
    this.aa = s
  }
  setBB(s: MobxSmallModel) {
    this.bb = s
  }
  setCC(s: MobxSmallModel) {
    this.cc = s
  }
  setDD(s: MobxSmallModel) {
    this.dd = s
  }
  setA(x: string) {
    this.a = x
  }
  setB(x: string) {
    this.b = x
  }
  setC(x: string) {
    this.c = x
  }
  setD(x: string) {
    this.d = x
  }
}
