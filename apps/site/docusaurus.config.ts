import type * as Preset from "@docusaurus/preset-classic"
import type { Config } from "@docusaurus/types"

const docsRouteBasePath = "/"

const config: Config = {
  title: "mobx-keystone",
  tagline:
    "A MobX-powered state management solution based on data trees, with first-class support for TypeScript, snapshots, patches, and much more",
  url: "https://mobx-keystone.js.org",
  baseUrl: "/",
  staticDirectories: ["static", "generated-static"],
  onBrokenLinks: "ignore", // because of /api/ links
  favicon: "img/favicon.ico",
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
          sidebarPath: "./sidebars.ts",
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
    prism: {
      theme: {
        plain: { color: "#22252b", backgroundColor: "#f6f7f9" },
        styles: [
          { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "#606570" } },
          { types: ["keyword", "boolean", "number"], style: { color: "#8f3ca2" } },
          { types: ["string", "char", "attr-value", "regex"], style: { color: "#267154" } },
          { types: ["function", "class-name", "tag"], style: { color: "#c44e00" } },
          { types: ["property", "attr-name", "symbol"], style: { color: "#285e91" } },
          { types: ["operator", "punctuation"], style: { color: "#606570" } },
        ],
      },
      darkTheme: {
        plain: { color: "#eeece8", backgroundColor: "#111215" },
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
        {
          type: "doc",
          docId: "intro",
          position: "right",
          label: "Documentation",
        },
        {
          href: "/api/",
          target: "_blank",
          label: "API",
          position: "right",
        },
        {
          href: "https://github.com/xaviergonz/mobx-keystone",
          label: "GitHub",
          position: "right",
        },
        {
          href: "https://www.npmjs.com/package/mobx-keystone",
          label: "npm",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      copyright: `Copyright © ${new Date().getFullYear()} Javier González Garcés`,
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
