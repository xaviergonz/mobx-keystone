export default {
  title: "mobx-state-tree-next",
  description: "Opinionated, transactional, MobX powered state container",
  typescript: true,
  propsParser: false,
  codeSandbox: false,
  menu: [
    "Introduction",
    { name: "Models", menu: ["Basics", "Root Stores"] },
    "Snapshots",
    "Patches",
    { name: "Action Middlewares", menu: ["Basics"] },
    "References",
    "Frozen Data",
    { name: "Examples", menu: ["Todo List", "Client/Server"] },
    "API Reference 🔗",
    "GitHub Repo 🔗",
    "NPM Project Page 🔗"
  ],
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
