import { type MouseEvent, memo, type ReactNode, useId, useRef, useState } from "react"
import Markdown, { type Components } from "react-markdown"
import styles from "./ChangelogModal.module.css"

const repoUrl = "https://github.com/xaviergonz/mobx-keystone"
const changelogUrl = `${repoUrl}/blob/master/CHANGELOG.md`
const changelogRawUrl =
  "https://raw.githubusercontent.com/xaviergonz/mobx-keystone/master/CHANGELOG.md"

interface MarkdownNode {
  type: string
  depth?: number
  value?: string
  url?: string
  children?: MarkdownNode[]
}

const issuePattern = /(?<![\w&/])#(\d+)\b/g

// Turns `#123` in plain text (not in code or existing links) into a link to that issue / PR.
function linkIssues(node: MarkdownNode) {
  if (!node.children || node.type === "link" || node.type === "linkReference") return
  node.children = node.children.flatMap((child): MarkdownNode | MarkdownNode[] => {
    if (child.type !== "text") {
      linkIssues(child)
      return child
    }
    const parts: MarkdownNode[] = []
    const text = child.value!
    let lastIndex = 0
    for (const match of text.matchAll(issuePattern)) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", value: text.slice(lastIndex, match.index) })
      }
      parts.push({
        type: "link",
        url: `${repoUrl}/issues/${match[1]}`,
        children: [{ type: "text", value: match[0] }],
      })
      lastIndex = match.index + match[0].length
    }
    if (lastIndex === 0) return child
    if (lastIndex < text.length) parts.push({ type: "text", value: text.slice(lastIndex) })
    return parts
  })
}

// Remark plugin that drops the top-level title (the modal shows its own) and version headings
// without entries (e.g. an empty "Unreleased" section), and links issue references.
function remarkChangelog() {
  return (tree: MarkdownNode) => {
    const children = tree.children ?? []
    const isSectionHeading = (node: MarkdownNode | undefined) =>
      node?.type === "heading" && node.depth! <= 2
    tree.children = children.filter(
      (node, i) =>
        !(node.type === "heading" && node.depth === 1) &&
        !(
          isSectionHeading(node) &&
          (i === children.length - 1 || isSectionHeading(children[i + 1]))
        )
    )
    linkIssues(tree)
  }
}

const remarkPlugins = [remarkChangelog]

const markdownComponents: Components = {
  // Versions sit below the modal's own `h2` title.
  h2: "h3",
  a: ({ node: _node, children, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
}

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; markdown: string }

async function fetchChangelog() {
  const res = await fetch(changelogRawUrl)
  if (!res.ok) throw new Error(`Failed to fetch the changelog: ${res.status}`)
  return res.text()
}

// Memoized, so re-renders of the page (e.g. toggling the sidebar) do not parse the changelog again.
const ChangelogContent = memo(function ChangelogContent({ state }: { state: LoadState }) {
  switch (state.status) {
    case "idle":
      return null
    case "loading":
      return <p className={styles.status}>Loading the changelog…</p>
    case "error":
      return (
        <p className={styles.status}>
          The changelog could not be loaded.{" "}
          <a href={changelogUrl} target="_blank" rel="noopener noreferrer">
            Read it on GitHub →
          </a>
        </p>
      )
    case "loaded":
      return (
        <div className={styles.markdown}>
          <Markdown remarkPlugins={remarkPlugins} components={markdownComponents}>
            {state.markdown}
          </Markdown>
        </div>
      )
  }
})

/**
 * A link to the changelog on GitHub that, on a plain click, shows the changelog in a modal instead.
 */
export function ChangelogLink({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  // Where the last press started, so a text selection dragged out to the backdrop
  // does not count as a backdrop click.
  const pressTargetRef = useRef<EventTarget | null>(null)
  const titleId = useId()
  const [state, setState] = useState<LoadState>({ status: "idle" })

  const open = (e: MouseEvent<HTMLAnchorElement>) => {
    // Modified clicks (new tab, new window...) keep the plain link behavior.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    // Downloaded on the first opening, and again on later ones if it failed.
    if (state.status === "idle" || state.status === "error") {
      setState({ status: "loading" })
      fetchChangelog().then(
        (markdown) => setState({ status: "loaded", markdown }),
        () => setState({ status: "error" })
      )
    }
    dialogRef.current?.showModal()
    // Each opening starts from the latest entries, not where the previous one was left.
    // (Only once shown: a closed dialog is not rendered, so it ignores scroll changes.)
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }

  return (
    <>
      <a className={className} href={changelogUrl} onClick={open}>
        {children}
      </a>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop clicks are a mouse shortcut; keyboard users close the modal dialog with Esc (native) or the close button */}
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={titleId}
        onPointerDown={(e) => {
          pressTargetRef.current = e.target
        }}
        // Clicking the backdrop (the dialog element itself, outside its panel) closes it.
        onClick={(e) => {
          if (e.target === e.currentTarget && pressTargetRef.current === e.currentTarget) {
            e.currentTarget.close()
          }
        }}
      >
        <div className={styles.panel}>
          <header className={styles.header}>
            <h2 id={titleId}>Changelog</h2>
            <a href={changelogUrl} target="_blank" rel="noopener noreferrer">
              View on GitHub
            </a>
            <button
              type="button"
              className={styles.close}
              // Focused when the dialog opens, instead of the first link.
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- moves focus into a modal dialog, as expected
              autoFocus
              onClick={() => dialogRef.current?.close()}
              aria-label="Close"
            >
              ×
            </button>
          </header>
          <div ref={bodyRef} className={styles.body}>
            <ChangelogContent state={state} />
          </div>
        </div>
      </dialog>
    </>
  )
}
