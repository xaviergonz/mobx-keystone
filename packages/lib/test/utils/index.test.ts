import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "@typescript/typescript6"
import * as mobx from "mobx"

const utilsCode = ts.transpileModule(readFileSync("src/utils/index.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText

function loadInDevMode(code: string, globals: object) {
  const exports: Record<string, unknown> = {}
  runInNewContext(code, { exports, require: () => mobx, ...globals })
  return exports.inDevMode
}

test.each([{}, { process: undefined }, { process: { env: undefined } }, { process: { env: {} } }])(
  "utilities load without a Node process environment: %j",
  (globals) => {
    expect(loadInDevMode(utilsCode, globals)).toBe(false)
  }
)

test.each([
  ["development", true],
  ["test", true],
  ["production", false],
])(
  "inDevMode follows a bundler-replaced NODE_ENV without a global process: %s",
  (nodeEnv, expected) => {
    // what bundlers do with `define` / `process.env.NODE_ENV` replacement
    const bundledCode = utilsCode.replaceAll("process.env.NODE_ENV", JSON.stringify(nodeEnv))
    expect(bundledCode).not.toBe(utilsCode)
    expect(loadInDevMode(bundledCode, {})).toBe(expected)
  }
)

test.each([
  ["development", true],
  ["production", false],
])("inDevMode follows NODE_ENV in Node: %s", (nodeEnv, expected) => {
  expect(loadInDevMode(utilsCode, { process: { env: { NODE_ENV: nodeEnv } } })).toBe(expected)
})
