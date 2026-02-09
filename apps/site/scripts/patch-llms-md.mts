#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import fg from "fast-glob"
import remarkMdx from "remark-mdx"
import remarkParse from "remark-parse"
import remarkStringify from "remark-stringify"
import { unified } from "unified"
import { visit } from "unist-util-visit"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const siteRoot = path.resolve(__dirname, "..")
const docsExamplesDir = path.join(siteRoot, "docs", "examples")
const generatedMdDir = path.join(siteRoot, "generated-static", "md")
const generatedExamplesDir = path.join(generatedMdDir, "examples")
const RAW_IMPORT_RE = /import\s+(\w+)\s+from\s+"!!raw-loader!\.\/([^"]+)"/g
const JSX_TAG_LINE_RE = /^<\/?[\w-]+(?:\s+[^>]*)?>$/
const LEADING_TITLE_RE = /^\uFEFF?#\s+[^\n]*\n+/

const mdxProcessor = unified().use(remarkParse).use(remarkMdx)
const mdProcessor = unified().use(remarkParse).use(remarkStringify, { fences: true, bullet: "-" })
const heading = (depth: number, value: string, inline = false) => ({
  type: "heading",
  depth,
  children: [{ type: inline ? "inlineCode" : "text", value }],
})
const nodeText = (n: any): string =>
  (n.children ?? [])
    .map((c: any) => (typeof c.value === "string" ? c.value : nodeText(c)))
    .join("")
    .trim()

function extractCodeSpecs(mdxContent: string) {
  const importMap = new Map([...mdxContent.matchAll(RAW_IMPORT_RE)].map((m) => [m[1], m[2]]))
  const tree = mdxProcessor.parse(mdxContent)
  const specs: Array<{ relFile: string; fileName: string; language: string }> = []

  visit(tree, "mdxJsxFlowElement", (node: any) => {
    if (node.name !== "CodeBlock") return
    const className = node.attributes?.find(
      (a: any) => a?.type === "mdxJsxAttribute" && a.name === "className"
    )?.value
    const language =
      typeof className === "string" ? (className.match(/\blanguage-([\w-]+)/)?.[1] ?? "") : ""
    const expr = node.children?.find(
      (c: any) => c.type === "mdxFlowExpression" || c.type === "mdxTextExpression"
    )?.value
    const varName = typeof expr === "string" ? expr.trim().match(/^([A-Za-z_$][\w$]*)$/)?.[1] : ""
    const relFile = varName ? importMap.get(varName) : undefined
    if (relFile) specs.push({ relFile, fileName: path.basename(relFile), language })
  })

  return specs
}

function trimTrailingJsx(nodes: any[]) {
  const out = [...nodes]
  while (out.length) {
    const last = out.at(-1)
    if (last?.type === "html" && JSX_TAG_LINE_RE.test(String(last.value ?? "").trim())) out.pop()
    else break
  }
  return out
}

function firstCodeSectionIndex(children: any[], fileNames: Set<string>) {
  for (let i = 0; i < children.length; i += 1) {
    const n = children[i]
    if (n.type !== "heading") continue
    const t = nodeText(n)
    if ((n.depth === 2 && t === "Code") || (n.depth === 3 && fileNames.has(t))) return i
  }
  return children.length
}

function withFilenameTitle(content: string, mdRelativePath: string) {
  const lineEnding = content.includes("\r\n") ? "\r\n" : "\n"
  const normalized = content.replace(/\r\n/g, "\n")
  const title = mdRelativePath.replace(/\\/g, "/").replace(/\.md$/, "")
  const body = normalized.replace(LEADING_TITLE_RE, "").trimStart().trimEnd()
  const output = `# ${title}\n\n${body}\n`
  return lineEnding === "\n" ? output : output.replace(/\n/g, "\r\n")
}

async function patchExampleCodeBlocks(mdxPath: string) {
  const mdxDir = path.dirname(mdxPath)
  const specs = extractCodeSpecs(await fs.readFile(mdxPath, "utf8"))
  if (!specs.length) return false

  const relFromExamples = path.relative(docsExamplesDir, mdxPath)
  const generatedMdPath = path.join(generatedExamplesDir, relFromExamples.replace(/\.mdx$/, ".md"))

  let generated: string
  try {
    generated = await fs.readFile(generatedMdPath, "utf8")
  } catch {
    return false
  }

  const sourceMap = new Map<string, string>(
    await Promise.all(
      specs.map(async (s): Promise<[string, string]> => [
        s.relFile,
        (await fs.readFile(path.join(mdxDir, s.relFile), "utf8")).replace(/\r\n/g, "\n").trimEnd(),
      ])
    )
  )

  const tree: any = mdProcessor.parse(generated)
  const children = Array.isArray(tree.children) ? tree.children : []
  const cutIndex = firstCodeSectionIndex(children, new Set(specs.map((s) => s.fileName)))
  tree.children = [...trimTrailingJsx(children.slice(0, cutIndex)), heading(2, "Code")]
  for (const s of specs) {
    tree.children.push(heading(3, s.fileName, true))
    tree.children.push({
      type: "code",
      lang: s.language || null,
      value: sourceMap.get(s.relFile) ?? "",
    })
  }

  let patched = String(mdProcessor.stringify(tree as any))
  if (generated.includes("\r\n")) patched = patched.replace(/\n/g, "\r\n")
  if (patched === generated) return false
  await fs.writeFile(generatedMdPath, patched, "utf8")
  return true
}

async function patchFileTitles() {
  const mdFiles = await fg("**/*.md", { cwd: generatedMdDir, absolute: true, onlyFiles: true })
  let titledCount = 0
  for (const mdPath of mdFiles) {
    const current = await fs.readFile(mdPath, "utf8")
    const relativePath = path.relative(generatedMdDir, mdPath)
    const next = withFilenameTitle(current, relativePath)
    if (next === current) continue
    await fs.writeFile(mdPath, next, "utf8")
    titledCount += 1
  }
  return titledCount
}

async function main() {
  const mdxFiles = await fg("**/*.mdx", { cwd: docsExamplesDir, absolute: true, onlyFiles: true })
  let patchedExamplesCount = 0
  for (const mdxPath of mdxFiles) if (await patchExampleCodeBlocks(mdxPath)) patchedExamplesCount += 1
  const titledCount = await patchFileTitles()
  process.stdout.write(
    `Patched ${patchedExamplesCount} generated markdown example files and titled ${titledCount} markdown files.\n`
  )
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
})
