// Generates the API reference as markdown, which the docs site renders at /api.
module.exports = {
  plugin: ["typedoc-plugin-markdown", "typedoc-docusaurus-theme"],
  excludePrivate: true,
  excludeProtected: true,
  validation: {
    notExported: false,
  },
  readme: "none",
  out: "../../apps/site/generated-api",
  docsPath: "../../apps/site/generated-api",
  tsconfig: "tsconfig.json",
  disableSources: true,
  entryFileName: "index",
  // Escapes angle brackets etc. in doc comments so MDX does not parse them as JSX.
  sanitizeComments: true,
  // Signatures as highlighted code blocks, and compact tables for parameters and enum members.
  useCodeBlocks: true,
  parametersFormat: "table",
  enumMembersFormat: "table",
  sidebar: { pretty: true },
}
