export default {
  title: "mobx-keystone",
  description:
    "A MobX powered state management solution based on data trees with first class support for Typescript, snapshots, patches and much more",
  typescript: true,
  propsParser: false,
  codeSandbox: false,
  menu: [
    "Introduction",
    "Comparison with mobx-state-tree",
    "Models",
    "Tree-Like Structure",
    "Root Stores",
    "Snapshots",
    "Patches",
    "Maps & Sets",
    {
      name: "Action Middlewares",
      menu: [
        "onActionMiddleware",
        "transactionMiddleware",
        "undoMiddleware",
        "readonlyMiddleware",
        "Custom Middlewares",
      ],
    },
    "Contexts",
    "References",
    "Frozen Data",
    "Runtime Type Checking",
    "Property Transforms",
    "Redux Compatibility",
    { name: "Examples", menu: ["Todo List", "Client/Server"] },
    "API Reference",
    "GitHub Repo 🔗",
    "NPM Project Page 🔗",
  ],
  htmlContext: {
    head: {
      links: [
        {
          rel: "stylesheet",
          href: "https://codemirror.net/theme/blackboard.css",
        },
      ],
    },
  },
  themeConfig: {
    logo: {
      src: "/public/images/lib-logo.png",
      width: 100,
    },
    mode: "dark",
    codemirrorTheme: "blackboard",
    showPlaygroundEditor: false,
    linesToScrollEditor: 50,
    colors: {
      codeColor: "#8DB6DE",
      codeBg: "#0C1021",
      blockquoteColor: "#8DB6DE",
      blockquoteBg: "#0C1021",
    },
  },
  src: "./src",
  public: "./src/public",
  plugins: [],
}
