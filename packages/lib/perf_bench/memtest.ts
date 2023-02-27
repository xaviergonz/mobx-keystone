import { observable } from "mobx"
import { Model, model, prop, Type, types } from "../src"

function main(numProps: number) {
  console.log(`[${numProps} props]`)
  console.log()

  function measure<R>(name: string, fn: () => R): R {
    global.gc!()
    const start = process.memoryUsage().heapUsed
    const v = fn()
    global.gc!()
    const end = process.memoryUsage().heapUsed

    const diff = end - start
    console.log(`${name}: ${Math.round(diff / 1024)}KB (${Math.ceil(diff / numProps)}B/prop)`)

    return v
  }

  function plainObj<T>(defValue: (i: number) => T) {
    const obj = {} as any
    for (let i = 0; i < numProps; i++) {
      obj[`prop${i}`] = defValue(i)
    }
    return obj
  }

  function runTests<T>(defValue: (i: number) => T, typedProp: Type<any, any>) {
    measure("plainObj", () => plainObj(defValue))

    measure("plainMap", () => {
      const map = new Map()
      for (let i = 0; i < numProps; i++) {
        map.set(`prop${i}`, defValue(i))
      }
      return map
    })

    measure("mobxObj", () => {
      const obj = observable.object<any>({}, undefined, { deep: false })
      for (let i = 0; i < numProps; i++) {
        let dv = defValue(i)
        if (typeof dv === "object" && dv !== null) dv = observable(dv)
        obj[`prop${i}`] = dv
      }
      return obj
    })

    measure("mobxMap", () => {
      const map = observable.map<any>()
      for (let i = 0; i < numProps; i++) {
        let dv = defValue(i)
        if (typeof dv === "object" && dv !== null) dv = observable(dv)
        map.set(`prop${i}`, dv)
      }
      return map
    })

    const MksProp = measure("mobxKeystoneClass model creation (prop)", () => {
      const props = Object.create(null)
      for (let i = 0; i < numProps; i++) {
        props[`prop${i}`] = prop<T>()
      }

      @model("MKS-prop-" + Math.random())
      class MKS extends Model(props) {}

      return MKS
    })
    measure("mobxKeystoneClass instance creation (prop)", () => new MksProp(plainObj(defValue)))

    const MksTProp = measure("mobxKeystoneClass model creation (tProp)", () => {
      const props = Object.create(null)
      for (let i = 0; i < numProps; i++) {
        props[`prop${i}`] = typedProp
      }

      @model("MKS-tProp-" + Math.random())
      class MKS extends Model(props) {}

      return MKS
    })
    measure("mobxKeystoneClass instance creation (tProp)", () => new MksTProp(plainObj(defValue)))

    console.log()
  }

  console.log("# simple props")

  runTests((i) => i, types.number)

  console.log("# array props")

  runTests(() => [], types.array(types.number))
}

main(100)
main(10000)
