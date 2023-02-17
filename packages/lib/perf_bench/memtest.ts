import { observable } from "mobx"
import { Model, model, prop } from "../src"

function plainObj(numProps: number) {
  const obj = Object.create(null)
  for (let i = 0; i < numProps; i++) {
    obj[`prop${i}`] = i
  }
  return obj
}

function plainMap(numProps: number) {
  const map = new Map()
  for (let i = 0; i < numProps; i++) {
    map.set(`prop${i}`, i)
  }
  return map
}

function mobxObj(numProps: number) {
  const obj = observable.object<any>({}, undefined, { deep: false })
  for (let i = 0; i < numProps; i++) {
    obj[`prop${i}`] = i
  }
  return obj
}

function mobxMap(numProps: number) {
  const map = observable.map<any>()
  for (let i = 0; i < numProps; i++) {
    map.set(`prop${i}`, i)
  }
  return map
}

function mobxKeystoneClass(numProps: number) {
  const props = Object.create(null)
  for (let i = 0; i < numProps; i++) {
    props[`prop${i}`] = prop<number>()
  }

  @model("MKS")
  class MKS extends Model(props) {}

  return new MKS({})
}

function measure(name: string, fn: (numProps: number) => void, numProps: number) {
  global.gc!()
  const start = process.memoryUsage().heapUsed
  const v = fn(numProps)
  const end = process.memoryUsage().heapUsed

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  v // to avoid unused var warning

  console.log(`${name} [${numProps} props]: ${Math.round((end - start) / 1024)}KB`)
}

measure("plainObj", plainObj, 1000)
measure("plainMap", plainMap, 1000)
measure("mobxObj", mobxObj, 1000)
measure("mobxMap", mobxMap, 1000)
measure("mobxKeystoneClass", mobxKeystoneClass, 1000)
