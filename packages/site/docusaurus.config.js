// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "mobx-keystone",
  tagline:
    "A MobX powered state management solution based on data trees with first-class support for TypeScript, snapshots, patches and much more",
  url: "https://mobx-keystone.js.org",
  baseUrl: "/",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/favicon.ico",
  organizationName: "xaviergonz",
  projectName: "mobx-keystone",
  themes: [
    [
      "@docusaurus/theme-classic",
      /** @type {import('@docusaurus/theme-classic').Options} */
      {
        customCss: require.resolve("./src/css/custom.css"),
      },
    ],
  ],
  plugins: [
    [
      "@docusaurus/plugin-content-docs",
      /** @type {import('@docusaurus/plugin-content-docs').Options} */
      {
        sidebarPath: require.resolve("./sidebars.js"),
        editUrl: "https://github.com/xaviergonz/mobx-keystone/edit/master/packages/site/",
        routeBasePath: "/",
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      hideableSidebar: true,
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
            href: "/public/api/",
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
      prism: {
        theme: require("prism-react-renderer/themes/github"),
        darkTheme: require("prism-react-renderer/themes/palenight"),
      },
    }),
}

module.exports = config
