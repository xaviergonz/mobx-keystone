export interface SmallModelSnapshot {
  a?: string
  b?: string
  c?: string
  d?: string
}

export class ESSmallModel {
  a: string
  b: string
  c: string
  d: string

  static fromSnapshot(snapshot: SmallModelSnapshot) {
    return new ESSmallModel(snapshot)
  }

  constructor(props?: SmallModelSnapshot) {
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

  toJSON() {
    return {
      a: this.a,
      b: this.b,
      c: this.c,
      d: this.d,
    }
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

export class ESBigModel {
  a: string
  b: string
  c: string
  d: string
  aa: ESSmallModel
  bb: ESSmallModel
  cc: ESSmallModel
  dd: ESSmallModel

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
    return new ESBigModel({
      ...snapshot,
      aa: snapshot.aa ? ESSmallModel.fromSnapshot(snapshot.aa) : undefined,
      bb: snapshot.bb ? ESSmallModel.fromSnapshot(snapshot.bb) : undefined,
      cc: snapshot.cc ? ESSmallModel.fromSnapshot(snapshot.cc) : undefined,
      dd: snapshot.dd ? ESSmallModel.fromSnapshot(snapshot.dd) : undefined,
    })
  }

  constructor(props: {
    a?: string
    b?: string
    c?: string
    d?: string
    aa?: ESSmallModel
    bb?: ESSmallModel
    cc?: ESSmallModel
    dd?: ESSmallModel
  }) {
    this.a = props?.a ?? "a"
    this.b = props?.b ?? "b"
    this.c = props?.c ?? "c"
    this.d = props?.d ?? "d"
    this.aa = props?.aa ?? new ESSmallModel()
    this.bb = props?.bb ?? new ESSmallModel()
    this.cc = props?.cc ?? new ESSmallModel()
    this.dd = props?.dd ?? new ESSmallModel()
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

  toJSON() {
    return {
      a: this.a,
      b: this.b,
      c: this.c,
      d: this.d,
      aa: this.aa.toJSON(),
      bb: this.bb.toJSON(),
      cc: this.cc.toJSON(),
      dd: this.dd.toJSON(),
    }
  }

  setAA(s: ESSmallModel) {
    this.aa = s
  }
  setBB(s: ESSmallModel) {
    this.bb = s
  }
  setCC(s: ESSmallModel) {
    this.cc = s
  }
  setDD(s: ESSmallModel) {
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
