import * as Benchmark from "benchmark"
import chalk from "chalk"

export function bench(name: string, mobxKeyStoneImpl: Function, mstImpl: Function) {
  const suite = new Benchmark.Suite(name)

  const results: number[] = []

  suite
    .add(chalk.green("mobx-keystone"), mobxKeyStoneImpl)
    .add(chalk.red("mobx-state-tree"), mstImpl)
    // add listeners
    .on("start", () => {
      console.log(chalk.cyan(name))
    })
    .on("cycle", (event: Benchmark.Event) => {
      results.push((event.target as any).hz)
      console.log(String(event.target))
    })
    .on("complete", () => {
      const fastest = suite.filter("fastest").map("name" as any)
      const ratio = Math.max(...results) / Math.min(...results)
      console.log(`Fastest is ${fastest} by ${ratio.toFixed(2)}x`)
      console.log()
    })
    // run async
    .run({ async: false })
}
