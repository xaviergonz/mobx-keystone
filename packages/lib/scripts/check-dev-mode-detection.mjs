// Fails when a bundle in dist/ no longer reads `process.env.NODE_ENV` in a form bundlers replace
// (e.g. the build lowered it to optional chaining helpers or wrapped it in a `typeof process`
// guard), which would make `inDevMode` always false in browser development bundles.

import fs from "node:fs"
import path from "node:path"

const distDir = path.join(process.cwd(), "dist")
const bundles = fs.readdirSync(distDir).filter((file) => /\.m?js$/.test(file))
if (bundles.length === 0) {
  throw new Error(`no bundles found in ${distDir}`)
}

const errors = []
for (const bundle of bundles) {
  const code = fs.readFileSync(path.join(distDir, bundle), "utf8")
  const start = code.indexOf("function readInDevMode()")
  const end = code.indexOf("inDevMode = readInDevMode()", start)
  if (start < 0 || end < 0) {
    errors.push(`${bundle}: readInDevMode / inDevMode not found`)
    continue
  }

  const body = code.slice(start, end)
  const replaceable = body.match(/\bprocess\.env\.NODE_ENV\b/g)?.length ?? 0
  const allProcessRefs = body.match(/process/g)?.length ?? 0
  if (replaceable === 0 || replaceable !== allProcessRefs) {
    errors.push(
      `${bundle}: every use of process in readInDevMode must be the literal process.env.NODE_ENV:\n${body}`
    )
  }
}

if (errors.length > 0) {
  process.stderr.write(`dev mode detection is not bundler-replaceable:\n  ${errors.join("\n  ")}\n`)
  process.exit(1)
}

process.stdout.write(
  `${bundles.length} bundles checked, dev mode detection is bundler-replaceable\n`
)
