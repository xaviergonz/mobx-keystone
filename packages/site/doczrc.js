export default {
  title: "mobx-data-model",
  description:
    "A MobX powered state management solution based on data trees with first class support for Typescript, snapshots, patches and much more",
  typescript: true,
  propsParser: false,
  codeSandbox: false,
  menu: [
    "Introduction",
    { name: "Models", menu: ["Basics", "Traversing the Tree", "Root Stores"] },
    "Snapshots",
    "Patches",
    {
      name: "Action Middlewares",
      menu: [
        "Basics",
        "Transaction Middleware",
        "Undo Middleware",
        "Redux DevTools Middleware"
      ]
    },
    "References",
    "Frozen Data",
    { name: "Examples", menu: ["Todo List", "Client/Server"] },
    "API Reference",
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
