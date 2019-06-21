export default {
  title: "mobx-state-tree-next",
  description: "Opinionated, transactional, MobX powered state container",
  src: "content",
  files: "content/**/*.mdx",
  typescript: true,
  propsParser: false,
  codeSandbox: false,
  htmlContext: {
    head: {
      links: [
        {
          rel: "stylesheet",
          href: "https://codemirror.net/theme/blackboard.css"
        }
      ]
    }
  },
  themeConfig: {
    mode: "dark",
    codemirrorTheme: "blackboard",
    showPlaygroundEditor: false,
    linesToScrollEditor: 50,
    colors: {
      codeColor: "#8DB6DE",
      codeBg: "#0C1021",
      blockquoteColor: "#8DB6DE",
      blockquoteBg: "#0C1021"
    }
  },
  plugins: []
}
