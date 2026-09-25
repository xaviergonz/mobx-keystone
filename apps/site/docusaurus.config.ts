import { readFileSync } from "node:fs"
import type { LoadedContent } from "@docusaurus/plugin-content-docs"
import { toSidebarsProp } from "@docusaurus/plugin-content-docs/lib/props.js"
import type * as Preset from "@docusaurus/preset-classic"
import type { Config } from "@docusaurus/types"

const libVersion: string = JSON.parse(
  readFileSync(new URL("../../packages/lib/package.json", import.meta.url), "utf8")
).version

const docsRouteBasePath = "/"

const config: Config = {
  title: "mobx-keystone",
  tagline:
    "A MobX-powered state management solution based on data trees, with first-class support for TypeScript, snapshots, patches, and much more",
  url: "https://mobx-keystone.js.org",
  baseUrl: "/",
  staticDirectories: ["static", "generated-static"],
  onBrokenLinks: "throw",
  favicon: "img/favicon.ico",
  customFields: { libVersion },
  stylesheets: [
    "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;600;700&display=swap",
  ],
  headTags: [
    ...(["light", "dark"] as const).map((theme) => ({
      tagName: "link",
      attributes: {
        rel: "icon",
        type: "image/png",
        href: `/img/logo-${theme}.png`,
        media: `(prefers-color-scheme: ${theme})`,
      },
    })),
  ],
  organizationName: "xaviergonz",
  projectName: "mobx-keystone",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },
  presets: [
    [
      "@docusaurus/preset-classic",
      {
        docs: {
          sidebarPath: "./sidebars.mts",
          editUrl: "https://github.com/xaviergonz/mobx-keystone/edit/master/apps/site/",
          routeBasePath: docsRouteBasePath,
        },
        blog: false,
        sitemap: {},
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],
  plugins: [
    [
      "@docusaurus/plugin-content-docs",
      {
        // API reference, generated as markdown by `pnpm lib:build-docs`.
        id: "api",
        path: "generated-api",
        routeBasePath: "api",
        sidebarPath: "./sidebars-api.mts",
      },
    ],
    [
      "@easyops-cn/docusaurus-search-local",
      {
        hashed: true,
        searchBarShortcutHint: false,
        indexDocs: true,
        docsRouteBasePath,
        indexBlog: false,
        indexPages: false,
      },
    ],
    // Exposes the processed docs sidebar as global data so the homepage can show the same menu.
    () => ({
      name: "home-docs-sidebar",
      async allContentLoaded({ allContent, actions }) {
        const docsContent = allContent["docusaurus-plugin-content-docs"]?.default as
          | LoadedContent
          | undefined
        const version = docsContent?.loadedVersions[0]
        if (!version)
          throw new Error("Could not find the docs version to build the homepage sidebar.")
        actions.setGlobalData({ sidebar: toSidebarsProp(version).docs })
      },
    }),
    () => ({
      name: "webpack-wasm-plugin",
      configureWebpack(_config, isServer) {
        if (isServer) {
          // For SSR, mark loro-crdt and mobx-keystone-loro as external to avoid bundling WebAssembly
          return {
            externals: ["loro-crdt", "mobx-keystone-loro"],
          }
        }
        return {
          resolve: {
            alias: {
              "loro-crdt": "loro-crdt/base64/index.js",
            },
            fallback: {
              fs: false,
              path: false,
            },
          },
          experiments: {
            asyncWebAssembly: true,
            topLevelAwait: true,
          },
        }
      },
    }),
  ],

  themeConfig: {
    // Preview card for links shared on social media and chat apps.
    image: "img/social-card.png",
    prism: {
      theme: {
        plain: { color: "#1a1c21", backgroundColor: "rgba(255, 255, 255, 0.75)" },
        styles: [
          { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "#6e727a" } },
          { types: ["keyword", "boolean", "number"], style: { color: "#8f3ca2" } },
          { types: ["string", "char", "attr-value", "regex"], style: { color: "#267154" } },
          { types: ["function", "class-name", "tag"], style: { color: "#b04806" } },
          { types: ["property", "attr-name", "symbol"], style: { color: "#285e91" } },
          { types: ["operator", "punctuation"], style: { color: "#6e727a" } },
        ],
      },
      darkTheme: {
        plain: { color: "#eceae6", backgroundColor: "rgba(15, 17, 22, 0.8)" },
        styles: [
          { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "#a4a5ad" } },
          { types: ["keyword", "boolean", "number"], style: { color: "#cb9ce4" } },
          { types: ["string", "char", "attr-value", "regex"], style: { color: "#8bcaa8" } },
          { types: ["function", "class-name", "tag"], style: { color: "#ff9a58" } },
          { types: ["property", "attr-name", "symbol"], style: { color: "#9bc4ed" } },
          { types: ["operator", "punctuation"], style: { color: "#a4a5ad" } },
        ],
      },
    },
    navbar: {
      title: "mobx-keystone",
      logo: {
        alt: "mobx-keystone",
        src: "img/logo-light.png",
        srcDark: "img/logo-dark.png",
      },
      items: [
        // "API", or "Documentation" while browsing the API reference.
        { type: "custom-docsApiSwitch", position: "right" },
        // Shown as icons on desktop (see custom.css) and as text in the mobile drawer.
        {
          href: "https://github.com/xaviergonz/mobx-keystone",
          label: "GitHub",
          "aria-label": "GitHub repository",
          className: "navbar-icon-link navbar-icon-link--github",
          position: "right",
        },
        {
          href: "https://www.npmjs.com/package/mobx-keystone",
          label: "npm",
          "aria-label": "npm package",
          className: "navbar-icon-link navbar-icon-link--npm",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Introduction", to: "/intro" },
            { label: "Getting started", to: "/getting-started" },
            { label: "Todo list example", to: "/examples/todo-list" },
            { label: "API reference", to: "/api/" },
          ],
        },
        {
          title: "Coming from MST",
          items: [
            { label: "Comparison", to: "/mst-comparison" },
            { label: "Migration guide", to: "/mst-migration-guide" },
          ],
        },
        {
          title: "Community",
          items: [
            { label: "GitHub", href: "https://github.com/xaviergonz/mobx-keystone" },
            { label: "Issues", href: "https://github.com/xaviergonz/mobx-keystone/issues" },
            {
              label: "Discussions",
              href: "https://github.com/xaviergonz/mobx-keystone/discussions",
            },
          ],
        },
        {
          title: "More",
          items: [
            { label: "npm", href: "https://www.npmjs.com/package/mobx-keystone" },
            {
              label: "Changelog",
              href: "https://github.com/xaviergonz/mobx-keystone/blob/master/CHANGELOG.md",
            },
            { label: "llms.txt", href: "pathname:///llms.txt" },
            { label: "llms-full.txt", href: "pathname:///llms-full.txt" },
          ],
        },
      ],
      copyright: `MIT licensed · © ${new Date().getFullYear()} Javier González Garcés`,
    },
    docs: {
      sidebar: {
        hideable: true,
      },
    },
  } satisfies Preset.ThemeConfig,
}

// biome-ignore lint/style/noDefaultExport: Docusaurus loads this config via a default export.
export default config
