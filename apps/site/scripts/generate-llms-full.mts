#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sidebars from "../sidebars.ts"

type SidebarNode = string | { type?: string; id?: string; items?: SidebarNode[] } | SidebarNode[]

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const siteRoot = path.resolve(__dirname, "..")
const generatedStaticDir = path.join(siteRoot, "generated-static")
const generatedMdDir = path.join(generatedStaticDir, "md")
const llmsFullPath = path.join(generatedStaticDir, "llms-full.txt")

function collectDocIds(sidebarNode: SidebarNode, out: string[]) {
  if (typeof sidebarNode === "string") {
    out.push(sidebarNode)
    return
  }

  if (Array.isArray(sidebarNode)) {
    for (const item of sidebarNode) collectDocIds(item, out)
    return
  }

  if (!sidebarNode || typeof sidebarNode !== "object") return

  if (sidebarNode.type === "doc" && typeof sidebarNode.id === "string") {
    out.push(sidebarNode.id)
    return
  }

  if (typeof sidebarNode.id === "string") out.push(sidebarNode.id)
  if (Array.isArray(sidebarNode.items)) collectDocIds(sidebarNode.items, out)
}

function uniqueInOrder(items: string[]) {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const item of items) {
    if (seen.has(item)) continue
    seen.add(item)
    unique.push(item)
  }
  return unique
}

async function main() {
  const docsSidebar = (sidebars as { docs?: SidebarNode }).docs
  if (!docsSidebar) throw new Error("Could not find `docs` sidebar in sidebars.ts.")

  const orderedDocIds: string[] = []
  collectDocIds(docsSidebar, orderedDocIds)
  const docIds = uniqueInOrder(orderedDocIds)

  const missing: string[] = []
  const sections: string[] = []

  for (const docId of docIds) {
    const filePath = path.join(generatedMdDir, `${docId}.md`)
    try {
      const raw = await fs.readFile(filePath, "utf8")
      const markdown = raw.replace(/\r\n/g, "\n").trim()
      sections.push(markdown)
    } catch {
      missing.push(filePath)
    }
  }

  if (missing.length) {
    throw new Error(
      `Could not build llms-full.txt. Missing ${missing.length} markdown files:\n${missing.join("\n")}`
    )
  }

  const output = ["# mobx-keystone", "", sections.join("\n\n---\n\n"), ""].join("\n")

  await fs.writeFile(llmsFullPath, output, "utf8")
  process.stdout.write(
    `Generated ${path.relative(siteRoot, llmsFullPath)} from ${docIds.length} markdown files.\n`
  )
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
})
