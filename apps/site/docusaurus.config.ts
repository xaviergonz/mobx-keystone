import type * as Preset from "@docusaurus/preset-classic"
import type { Config } from "@docusaurus/types"

const docsRouteBasePath = "/"

const config: Config = {
  title: "mobx-keystone",
  tagline:
    "A MobX powered state management solution based on data trees with first-class support for TypeScript, snapshots, patches and much more",
  url: "https://mobx-keystone.js.org",
  baseUrl: "/",
  onBrokenLinks: "ignore", // because of /api/ links
  favicon: "img/favicon.ico",
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
          sidebarPath: require.resolve("./sidebars.js"),
          editUrl: "https://github.com/xaviergonz/mobx-keystone/edit/master/apps/site/",
          routeBasePath: docsRouteBasePath,
        },
        blog: false,
        sitemap: {},
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      } satisfies Preset.Options,
    ],
  ],
  plugins: [
    [
      "@easyops-cn/docusaurus-search-local",
      {
        hashed: true,
        indexDocs: true,
        docsRouteBasePath,
        indexBlog: false,
        indexPages: false,
      },
    ],
    () => ({
      name: "webpack-wasm-plugin",
      configureWebpack() {
        return {
          resolve: {
            alias: {
              "loro-crdt": require.resolve("loro-crdt/base64/index.js"),
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
    navbar: {
      style: "dark",
      title: "mobx-keystone",
      logo: {
        alt: "mobx-keystone",
        src: "img/logo.png",
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

module.exports = config
