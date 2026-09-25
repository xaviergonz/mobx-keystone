#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import fg from "fast-glob"

// get-llms-txt drops JSX components together with their content, which would lose everything
// inside <Tabs>. This copies the docs with tabs flattened into plain markdown, where each tab
// becomes a bold label followed by its content, and get-llms-txt then reads that copy.
// Docusaurus `// highlight-...` directive comments are removed as well.

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const siteRoot = path.resolve(__dirname, "..")
const docsDir = path.join(siteRoot, "docs")
const outDir = path.join(siteRoot, ".llms-docs")

const TABS_TAG_RE = /^\s*<\/?Tabs(?:\s[^>]*)?>\s*$/
const TAB_ITEM_CLOSE_RE = /^\s*<\/TabItem>\s*$/
const HIGHLIGHT_COMMENT_RE = /^\s*\/\/ highlight-(?:next-line|start|end)\s*$/
const TAB_ITEM_OPEN_RE = /^\s*<TabItem\s[^>]*\blabel="([^"]*)"[^>]*>\s*$/

function flattenTabs(content: string) {
  return content
    .split("\n")
    .flatMap((line) => {
      if (TABS_TAG_RE.test(line) || TAB_ITEM_CLOSE_RE.test(line) || HIGHLIGHT_COMMENT_RE.test(line))
        return []
      const label = line.match(TAB_ITEM_OPEN_RE)?.[1]
      return label === undefined ? [line] : [`**${label}**`]
    })
    .join("\n")
}

async function main() {
  await fs.rm(outDir, { recursive: true, force: true })
  const files = await fg("**/*.{md,mdx}", { cwd: docsDir, onlyFiles: true })
  for (const file of files) {
    const content = (await fs.readFile(path.join(docsDir, file), "utf8")).replace(/\r\n/g, "\n")
    const target = path.join(outDir, file)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, flattenTabs(content), "utf8")
  }
  process.stdout.write(`Prepared ${files.length} docs for llms.txt generation.\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
})
