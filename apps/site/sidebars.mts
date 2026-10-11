import type { SidebarsConfig } from "@docusaurus/plugin-content-docs"

const section = (value: string) =>
  ({ type: "html", value, className: "sidebar-section-label" }) as const

const doc = (id: string, label: string) => ({ type: "doc", id, label }) as const

const sidebars: SidebarsConfig = {
  docs: [
    section("Start here"),
    "intro",
    "installation",
    "gettingStarted",

    section("Core concepts"),
    "classModels",
    "dataModels",
    "standardAndStandaloneActions",
    "treeLikeStructure",
    "rootStores",
    "snapshots",
    "patches",
    "mapsSetsDates",

    section("Modeling"),
    "references",
    "frozen",
    "contexts",
    "computedTrees",
    "runtimeTypeChecking",

    section("Change control"),
    {
      type: "category",
      label: "Action Middlewares",
      items: [
        "actionMiddlewares/onActionMiddleware",
        "actionMiddlewares/transactionMiddleware",
        "actionMiddlewares/undoMiddleware",
        "actionMiddlewares/readonlyMiddleware",
        "actionMiddlewares/customMiddlewares",
      ],
    },
    "serialization",
    "drafts",
    "sandboxes",

    section("Integrations"),
    doc("integrations/yjsBinding", "Y.js Binding"),
    doc("integrations/loroBinding", "Loro Binding"),
    doc("integrations/reduxCompatibility", "Redux Compatibility"),

    section("Examples"),
    doc("examples/todoList/todoList", "Todo List"),
    doc("examples/clientServer/clientServer", "Client/Server"),
    doc("examples/yjsBinding/yjsBinding", "Y.js Binding"),
    doc("examples/loroBinding/loroBinding", "Loro Binding"),

    section("Coming from MST"),
    doc("mstComparison", "Comparison"),
    doc("mstMigrationGuide", "Migration Guide"),

    section("Deprecated"),
    doc("deprecated/actionSerialization", "Action Serialization"),
    doc("deprecated/transformsAndCollectionModels", "Property Transforms and Collection Models"),
  ],
}

// oxlint-disable-next-line import/no-default-export -- Docusaurus sidebars are consumed through a default export.
export default sidebars
