import { observable } from "mobx"
import { Model, model, prop } from "../src"

function measure<R>(name: string, fn: () => R): R {
  global.gc!()
  const start = process.memoryUsage().heapUsed
  const v = fn()
  global.gc!()
  const end = process.memoryUsage().heapUsed

  console.log(`${name}: ${Math.round((end - start) / 1024)}KB`)

  return v
}

function main(numProps: number) {
  console.log(`[${numProps} props]`)

  function plainObj() {
    const obj = {} as any
    for (let i = 0; i < numProps; i++) {
      obj[`prop${i}`] = i
    }
    return obj
  }

  measure("plainObj", plainObj)

  measure("plainMap", () => {
    const map = new Map()
    for (let i = 0; i < numProps; i++) {
      map.set(`prop${i}`, i)
    }
    return map
  })

  measure("mobxObj", () => {
    const obj = observable.object<any>({}, undefined, { deep: false })
    for (let i = 0; i < numProps; i++) {
      obj[`prop${i}`] = i
    }
    return obj
  })

  measure("mobxMap", () => {
    const map = observable.map<any>()
    for (let i = 0; i < numProps; i++) {
      map.set(`prop${i}`, i)
    }
    return map
  })

  const MKS = measure("mobxKeystoneClass model creation", () => {
    const props = Object.create(null)
    for (let i = 0; i < numProps; i++) {
      props[`prop${i}`] = prop<number>()
    }

    @model("MKS")
    class MKS extends Model(props) {}

    return MKS
  })
  measure("mobxKeystoneClass instance creation", () => new MKS(plainObj()))
}

main(10000)
