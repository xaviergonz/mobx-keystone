module.exports = {
  src: ["src/index.ts"],
  module: "commonjs",
  excludeNotExported: true,
  excludePrivate: true,
  excludeProtected: true,
  mode: "file",
  readme: "none",
  out: "../site/src/public/api",
  tsconfig: "tsconfig.json",
  listInvalidSymbolLinks: true,
}
