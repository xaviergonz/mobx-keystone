import * as Benchmark from "benchmark"
import chalk from "chalk"

export function bench(
  name: string,
  mobxKeyStoneImpl: Function,
  mstImpl: Function,
  es6Impl?: Function,
  mobxImpl?: Function
) {
  let suite = new Benchmark.Suite(name)

  let results: Record<string, Benchmark.Target> = {}

  const keystone = chalk.green("mobx-keystone")
  const mst = chalk.red("mobx-state-tree")
  const es6 = chalk.magenta("raw es6")
  const mobx = chalk.blue("raw mobx")

  suite = suite.add(keystone, mobxKeyStoneImpl).add(mst, mstImpl)

  if (es6Impl) {
    suite = suite.add(es6, es6Impl)
  }
  if (mobxImpl) {
    suite = suite.add(mobx, mobxImpl)
  }

  // add listeners
  suite
    .on("start", () => {
      console.log(chalk.cyan(name))
      results = {}
    })
    .on("cycle", (event: Benchmark.Event) => {
      results[event.target.name!] = event.target
      console.log(String(event.target))
    })
    .on("complete", () => {
      const keystoneSpeed = results[keystone].hz!
      const mstSpeed = results[mst].hz!
      const fastest = keystoneSpeed > mstSpeed ? keystone : mst

      const ratio = Math.max(keystoneSpeed, mstSpeed) / Math.min(keystoneSpeed, mstSpeed)

      console.log(`Fastest is ${fastest} by ${ratio.toFixed(2)}x`)

      if (mobxImpl) {
        const mobxRatio = results[mobx].hz! / results[keystone].hz!
        console.log(`${mobx} is faster than mobx-keystone by ${mobxRatio.toFixed(2)}x`)
      }

      if (es6Impl) {
        const es6Ratio = results[es6].hz! / results[keystone].hz!
        console.log(`${es6} is faster than mobx-keystone by ${es6Ratio.toFixed(2)}x`)
      }

      console.log()
    })
    // run async
    .run({ async: false })
}
