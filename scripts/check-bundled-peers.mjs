// Fails when a bundle in dist/ of the package in the current directory contains code of one of its
// peer dependencies (e.g. a private copy of mobx), which must always stay external.
// It relies on the `//#region <source path>` markers the bundler writes for every bundled module.

import fs from "node:fs"
import path from "node:path"

const packageDir = process.cwd()
const { name, peerDependencies = {} } = JSON.parse(
  fs.readFileSync(path.join(packageDir, "package.json"), "utf8")
)

// Real paths, since peers are usually symlinked (pnpm store, workspace packages).
const peerDirs = Object.keys(peerDependencies).map((peer) => ({
  peer,
  dir: fs.realpathSync(path.join(packageDir, "node_modules", peer)),
}))

const distDir = path.join(packageDir, "dist")
const bundles = fs.readdirSync(distDir).filter((file) => /\.m?js$/.test(file))
if (bundles.length === 0) {
  throw new Error(`${name}: no bundles found in ${distDir}`)
}

const errors = []
for (const bundle of bundles) {
  const code = fs.readFileSync(path.join(distDir, bundle), "utf8")
  const sources = [...code.matchAll(/^\s*\/\/#region (\S+)/gm)].map((m) => m[1])
  if (sources.length === 0) {
    errors.push(`${bundle}: has no //#region markers, so its bundled modules cannot be checked`)
    continue
  }

  for (const source of new Set(sources)) {
    // Virtual modules (bundler runtime / helpers) start with \0.
    if (source.startsWith("\\0")) continue
    const sourcePath = path.resolve(packageDir, source)
    for (const { peer, dir } of peerDirs) {
      if (sourcePath === dir || sourcePath.startsWith(dir + path.sep)) {
        errors.push(`${bundle}: bundles ${source} from peer dependency "${peer}"`)
      }
    }
  }
}

if (errors.length > 0) {
  process.stderr.write(
    `${name}: peer dependencies must not be bundled:\n  ${errors.join("\n  ")}\n`
  )
  process.exit(1)
}

process.stdout.write(`${name}: ${bundles.length} bundles checked, no peer dependencies bundled\n`)
