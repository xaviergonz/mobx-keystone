import Link from "@docusaurus/Link"
import type { PropSidebar } from "@docusaurus/plugin-content-docs"
import { DocsSidebarProvider } from "@docusaurus/plugin-content-docs/client"
import useDocusaurusContext from "@docusaurus/useDocusaurusContext"
import { usePluginData } from "@docusaurus/useGlobalData"
import DocRootLayoutSidebar from "@theme/DocRoot/Layout/Sidebar"
import Layout from "@theme/Layout"
import { Fragment, type ReactNode, useEffect, useState } from "react"
import { comment, deco, k, str, type } from "../components/home/codeTokens"
import shared from "../components/home/shared.module.css"
import { TreeGraphic } from "../components/home/TreeGraphic/TreeGraphic"
import { clsx } from "../utils/clsx"
import styles from "./index.module.css"

// The package manager itself is picked (and shown) by the dropdown, so these are just its arguments.
const installArgs = {
  pnpm: "add mobx mobx-keystone",
  npm: "install mobx mobx-keystone",
  yarn: "add mobx mobx-keystone",
}

type PackageManager = keyof typeof installArgs
const changelogUrl = "https://github.com/xaviergonz/mobx-keystone/blob/master/CHANGELOG.md"

const badges = [
  {
    alt: "license",
    src: "https://img.shields.io/npm/l/mobx-keystone.svg?style=flat&labelColor=333",
  },
  {
    alt: "types",
    src: "https://img.shields.io/npm/types/mobx-keystone.svg?style=flat&logo=typescript&labelColor=333",
  },
  {
    alt: "CI",
    src: "https://img.shields.io/github/actions/workflow/status/xaviergonz/mobx-keystone/main.yml?branch=master&label=CI&logo=github&style=flat&labelColor=333",
    href: "https://github.com/xaviergonz/mobx-keystone/actions/workflows/main.yml",
  },
  {
    alt: "codecov",
    src: "https://img.shields.io/codecov/c/github/xaviergonz/mobx-keystone?token=6MLRFUBK8V&label=codecov&logo=codecov&style=flat&labelColor=333",
    href: "https://codecov.io/gh/xaviergonz/mobx-keystone",
  },
  {
    alt: "Netlify Status",
    src: "https://img.shields.io/netlify/c5f60bcb-c1ff-4d04-ad14-1fc34ddbb429?label=netlify&logo=netlify&style=flat&labelColor=333",
    href: "https://app.netlify.com/sites/mobx-keystone/deploys",
  },
]

function Badges() {
  return (
    <div className={styles.badges}>
      {badges.map(({ alt, src, href }) => {
        // A fixed height keeps the hero from shifting while the badges load.
        const img = <img alt={alt} src={src} height={20} loading="lazy" />
        return <Fragment key={alt}>{href ? <a href={href}>{img}</a> : img}</Fragment>
      })}
    </div>
  )
}

type GlowProps = {
  main: "a" | "b"
  left: string
  top: string
  width: string
  height: string
  opacity?: number
}

function Glow({ main, left, top, width, height, opacity }: GlowProps) {
  return (
    <div
      aria-hidden="true"
      className={clsx(styles.glow, main === "b" && styles.glowB)}
      style={{ left, top, width, height, opacity }}
    >
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  )
}

function InstallButton() {
  const [packageManager, setPackageManager] = useState<PackageManager>("pnpm")
  const [copied, setCopied] = useState(false)
  const args = installArgs[packageManager]
  const command = `${packageManager} ${args}`

  // Hides the "copied" hint again after a moment.
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = () => {
    navigator.clipboard?.writeText(command).then(
      () => setCopied(true),
      () => {} // Clipboard access denied; nothing to report.
    )
  }

  return (
    <div className={styles.install}>
      <span className={styles.installPrompt} aria-hidden="true">
        $
      </span>
      <select
        className={styles.installSelect}
        value={packageManager}
        onChange={(e) => {
          setPackageManager(e.target.value as PackageManager)
          setCopied(false)
        }}
        aria-label="Package manager"
      >
        {Object.keys(installArgs).map((pm) => (
          <option key={pm} value={pm}>
            {pm}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={styles.installCopy}
        onClick={copy}
        aria-label={copied ? "Install command copied" : `Copy install command: ${command}`}
      >
        {args}
        <span className={styles.installHint}>{copied ? "copied" : "copy"}</span>
      </button>
    </div>
  )
}

type GetCardProps = { label: string; call: string; children: ReactNode }

function GetCard({ label, call, children }: GetCardProps) {
  return (
    <div className={clsx(shared.glass, styles.getCard)}>
      <div className={styles.cardHead}>
        <span className={shared.blueText}>YOU GET · {label}</span>
        <span>{call}</span>
      </div>
      <pre>{children}</pre>
    </div>
  )
}

function WriteGet() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2>
          Write plain actions. <span className={shared.muted}>Get the rest for free.</span>
        </h2>
        <Link to="/getting-started">Getting started guide →</Link>
      </div>
      <div className={styles.writeGet}>
        <div className={clsx(shared.glass, styles.writeCard)}>
          <div className={clsx(styles.cardHead, styles.cardHeadBar)}>
            <span className={shared.accentText}>YOU WRITE</span>
            <span>Todo.ts</span>
          </div>
          <pre>
            {deco("@model")}({str('"todo/Todo"')}){"\n"}
            {k("class")} Todo {k("extends")} Model({"{\n"}
            {"  "}text: prop&lt;{type("string")}&gt;({str('""')}),{"\n"}
            {"  "}done: prop({k("false")}),{"\n"}
            {"}) {\n"}
            {"  "}
            {deco("@modelAction")}
            {"\n"}
            {"  "}toggle() {"{\n"}
            {"    "}
            {k("this")}.done = !{k("this")}.done{"\n"}
            {"  }\n"}
            {"}"}
          </pre>
        </div>
        <div className={styles.getGrid}>
          <GetCard label="SNAPSHOTS" call="getSnapshot(todo)">
            {"{ "}text: {str('"Write docs"')}, done: {k("true")}, $modelType: {str('"todo/Todo"')}
            {" }"}
          </GetCard>
          <GetCard label="TYPES" call="SnapshotOutOf<Todo>">
            {"{ "}text: {type("string")}; done: {type("boolean")}; …{" }"}
          </GetCard>
          <GetCard label="PATCHES" call="onPatches(todo, …)">
            [{"{ "}op: {str('"replace"')}, path: [{str('"done"')}], value: {k("true")}
            {" }"}]
          </GetCard>
          <GetCard label="REPLAYABLE ACTIONS" call="onActionMiddleware(store, …)">
            {"{ "}actionName: {str('"toggle"')}, args: [], targetPath: [{str('"todos"')}, 1]
            {" }"}
          </GetCard>
          <GetCard label="UNDO" call="undoMiddleware(store)">
            undoManager.undo() {comment("// done → false")}
          </GetCard>
          <GetCard label="RESTORE" call="fromSnapshot(Todo, sn)">
            {k("const")} copy = fromSnapshot(Todo, sn){"\n"}
            copy.toggle() {comment("// a live, typed Todo")}
          </GetCard>
          <GetCard label="PROTECTION" call="todo.done = true">
            {comment("// throws: data changes must be performed inside model actions")}
          </GetCard>
          <GetCard label="TREE" call="getParent(todo) · getRoot(todo)">
            getParent(todo) {comment("// store.todos")}
            {"\n"}
            getRoot(todo) {comment("// store")}
          </GetCard>
        </div>
      </div>
    </section>
  )
}

type FeatureProps = {
  to: string
  label: string
  title: string
  children: ReactNode
  blue?: boolean
  wide?: boolean
}

function Feature({ to, label, title, children, blue, wide }: FeatureProps) {
  return (
    <Link to={to} className={clsx(shared.glass, styles.feature, wide && styles.featureWide)}>
      <div>
        <div className={clsx(styles.eyebrow, blue ? shared.blueText : shared.accentText)}>
          {label}
        </div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
      {wide && (
        <div className={styles.timeline} aria-hidden="true">
          <span />
          <i />
          <span />
          <i />
          <span className={styles.timelineNow} />
          <i className={styles.timelineFuture} />
          <span className={styles.timelineRedo} />
        </div>
      )}
    </Link>
  )
}

function Features() {
  return (
    <section className={clsx(styles.section, styles.features)}>
      <Feature
        wide
        to="/action-middlewares/undo-middleware"
        label="MIDDLEWARES"
        title="Time travel built in"
      >
        Undo/redo, transactions, read-only guards and your own action middlewares.
      </Feature>
      <Feature blue to="/references" label="REFERENCES" title="Links that stay valid">
        First-class references between nodes, resolved as the tree changes.
      </Feature>
      <Feature blue to="/class-models" label="TYPESCRIPT" title="Inferred, not declared twice">
        Models, snapshots and actions typed from one definition.
      </Feature>
      <Feature to="/runtime-type-checking" label="RUNTIME TYPES" title="Checked when it matters">
        Opt into runtime type checking per prop with <code>tProp</code>.
      </Feature>
      <Feature to="/integrations/yjs-binding" label="CRDT" title="Y.js & Loro bindings">
        Collaborative, offline-friendly state with the same models.
      </Feature>
    </section>
  )
}

const hl = (s: string) => <strong className={shared.accentText}>{s}</strong>

const quotes = [
  {
    text: (
      <>
        It's taken {hl("all the best bits")} from mobx and mobx-state-tree and put them into a
        single package that's {hl("a joy to work with")}.
      </>
    ),
    user: "robclouth",
    issue: 146,
  },
  {
    text: <>After evaluating every state library out there, {hl("mobx-keystone stands out")}.</>,
    user: "lolmaus",
    issue: 566,
  },
  {
    text: (
      <>
        mobx-keystone is {hl("awesome")} and {hl("way easier")} to use for typesafe domain modeling
        than MST.
      </>
    ),
    user: "krnsk0",
    issue: 467,
  },
]

function Quotes() {
  return (
    <section className={styles.section}>
      <h2>Loved by the people who use it</h2>
      <div className={styles.quotes}>
        {quotes.map((q) => (
          <figure key={q.issue} className={shared.glass}>
            <blockquote>“{q.text}”</blockquote>
            <figcaption>
              <a href={`https://github.com/${q.user}`}>@{q.user}</a> ·{" "}
              <a href={`https://github.com/xaviergonz/mobx-keystone/issues/${q.issue}`}>
                #{q.issue}
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext()
  const version = String(siteConfig.customFields?.libVersion ?? "")
  const shortVersion = version.split(".").slice(0, 2).join(".")
  const { sidebar } = usePluginData("home-docs-sidebar") as { sidebar: PropSidebar }
  const [hiddenSidebar, setHiddenSidebar] = useState(false)

  return (
    <Layout description={siteConfig.tagline}>
      <DocsSidebarProvider name="docs" items={sidebar}>
        <div className={styles.layout}>
          <Glow main="a" left="20%" top="-7%" width="104%" height="800px" />
          <Glow main="b" left="-39%" top="22%" width="108%" height="820px" />
          <Glow main="a" left="11%" top="48%" width="111%" height="820px" />
          <Glow main="b" left="-36%" top="70%" width="97%" height="660px" opacity={0.58} />

          <DocRootLayoutSidebar
            sidebar={sidebar}
            hiddenSidebarContainer={hiddenSidebar}
            setHiddenSidebarContainer={setHiddenSidebar}
          />
          <main className={styles.home}>
            <section className={styles.hero}>
              <div className={styles.heroText}>
                <a className={styles.pill} href={changelogUrl}>
                  {shortVersion && <span>v{shortVersion}</span>}
                  What's new in the changelog →
                </a>
                <h1>
                  Your state is a <span className={shared.accentText}>living tree.</span>
                </h1>
                <p className={styles.lead}>
                  Mutable, protected models on the inside. Snapshots, JSON patches and replayable
                  actions on the outside. Powered by MobX, typed end to end.
                </p>
                <div className={styles.actions}>
                  <Link className={styles.primary} to="/intro">
                    Read the docs →
                  </Link>
                  <InstallButton />
                </div>
                <Badges />
              </div>
              <TreeGraphic />
            </section>

            <WriteGet />
            <Features />
            <Quotes />
          </main>
        </div>
      </DocsSidebarProvider>
    </Layout>
  )
}
