import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "@typescript/typescript6"
import * as mobx from "mobx"

const utilsCode = ts.transpileModule(readFileSync("src/utils/index.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText

test.each([{}, { process: undefined }, { process: { env: undefined } }, { process: { env: {} } }])(
  "utilities load without a Node process environment: %j",
  (globals) => {
    const exports: Record<string, unknown> = {}
    runInNewContext(utilsCode, { exports, require: () => mobx, ...globals })
    expect(exports.inDevMode).toBe(false)
  }
)
