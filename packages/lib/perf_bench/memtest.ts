import { observable } from "mobx"
import { Model, model, prop, tProp, types } from "../src"

const byteValueNumberFormatter = Intl.NumberFormat("en", {
  notation: "standard",
  style: "unit",
  unit: "byte",
  unitDisplay: "narrow",
})

function memtest(numProps: number, numInstances: number) {
  console.log(`[${numProps} props, ${numInstances} instances]`)
  console.log()

  function measure<R>(name: string, fn: () => R): R {
    global.gc!()
    const start = process.memoryUsage().heapUsed
    const v = fn()
    global.gc!()
    const end = process.memoryUsage().heapUsed

    const diff = end - start
    console.log(
      `${name}: ${byteValueNumberFormatter.format(diff)} (${byteValueNumberFormatter.format(
        Math.ceil(diff / (numProps * numInstances))
      )}/each)`
    )

    return v
  }

  function plainObj<T>(defValue: (i: number) => T) {
    const obj = {} as any
    for (let i = 0; i < numProps; i++) {
      obj[`prop${i}`] = defValue(i)
    }
    return obj
  }

  const createManyInstances = (fn: () => void) => {
    const arr = [] // keep the instances alive
    for (let i = 0; i < numInstances; i++) {
      arr.push(fn())
    }
    return arr
  }

  function runTests<T>(defValue: (i: number) => T, typedProp: any) {
    measure("plainObj", () => createManyInstances(() => plainObj(defValue)))

    measure("plainMap", () =>
      createManyInstances(() => {
        const map = new Map()
        for (let i = 0; i < numProps; i++) {
          map.set(`prop${i}`, defValue(i))
        }
        return map
      })
    )

    measure("mobxObj", () =>
      createManyInstances(() => {
        const obj = observable.object<any>({}, undefined, { deep: false })
        for (let i = 0; i < numProps; i++) {
          let dv = defValue(i)
          if (typeof dv === "object" && dv !== null) dv = observable(dv)
          obj[`prop${i}`] = dv
        }
        return obj
      })
    )

    measure("mobxMap", () =>
      createManyInstances(() => {
        const map = observable.map<any>()
        for (let i = 0; i < numProps; i++) {
          let dv = defValue(i)
          if (typeof dv === "object" && dv !== null) dv = observable(dv)
          map.set(`prop${i}`, dv)
        }
        return map
      })
    )

    const MksProp = measure("mobxKeystoneClass model creation (prop)", () => {
      const props = Object.create(null)
      for (let i = 0; i < numProps; i++) {
        props[`prop${i}`] = prop<T>()
      }

      @model("MKS-prop-" + Math.random())
      class MKS extends Model(props) {}

      return MKS
    })
    measure("mobxKeystoneClass instance creation (prop)", () =>
      createManyInstances(() => new MksProp(plainObj(defValue)))
    )

    const MksTProp = measure("mobxKeystoneClass model creation (tProp)", () => {
      const props = Object.create(null)
      for (let i = 0; i < numProps; i++) {
        props[`prop${i}`] = tProp(typedProp)
      }

      @model("MKS-tProp-" + Math.random())
      class MKS extends Model(props) {}

      return MKS
    })
    measure("mobxKeystoneClass instance creation (tProp)", () =>
      createManyInstances(() => new MksTProp(plainObj(defValue)))
    )

    console.log()
  }

  console.log("# simple props")

  runTests((i) => i, types.number)

  console.log("# array props")

  runTests(() => [], types.array(types.number))

  console.log("# object props")

  runTests(
    () => ({}),
    types.object(() => ({}))
  )
}

memtest(10000, 1)
// memtest(1, 2000)
