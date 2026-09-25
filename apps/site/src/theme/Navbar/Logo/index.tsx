import Link from "@docusaurus/Link"
import { useActivePlugin } from "@docusaurus/plugin-content-docs/client"
import NavbarLogo from "@theme-original/Navbar/Logo"
import styles from "./styles.module.css"

/**
 * Adds an "API" tag next to the logo while browsing the API reference, so it
 * is clear that part of the site is a separate section.
 */
export default function NavbarLogoWrapper() {
  const isApi = useActivePlugin()?.pluginId === "api"

  return (
    <>
      <NavbarLogo />
      {isApi && (
        <Link to="/api/" className={styles.apiTag}>
          API
        </Link>
      )}
    </>
  )
}
