declare module "*.svg" {
  import * as React from "react"

  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  // biome-ignore lint/style/noDefaultExport: SVG module declarations model the bundler's default export shape.
  export default ReactComponent
}
