import { useActivePlugin } from "@docusaurus/plugin-content-docs/client"
import DocSidebarNavbarItem from "@theme/NavbarItem/DocSidebarNavbarItem"
import type { ComponentProps } from "react"

type Props = Omit<ComponentProps<typeof DocSidebarNavbarItem>, "sidebarId" | "docsPluginId">

/**
 * Links to the API reference, or back to the documentation while browsing the
 * API reference.
 */
export default function DocsApiSwitchNavbarItem(props: Props) {
  const isApi = useActivePlugin()?.pluginId === "api"

  return isApi ? (
    <DocSidebarNavbarItem {...props} sidebarId="docs" label="Documentation" />
  ) : (
    <DocSidebarNavbarItem {...props} docsPluginId="api" sidebarId="api" label="API" />
  )
}
