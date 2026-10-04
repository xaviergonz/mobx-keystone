import Link from "@docusaurus/Link"
import { useActivePlugin } from "@docusaurus/plugin-content-docs/client"
import { useThemeConfig } from "@docusaurus/theme-common"
import useBaseUrl from "@docusaurus/useBaseUrl"
import styles from "./styles.module.css"

/**
 * The navbar logo, plus an "API" tag next to it while browsing the API reference, so it
 * is clear that part of the site is a separate section.
 *
 * Unlike the default logo (`ThemedImage`), which after hydration only mounts the image of
 * the current color mode, both images stay mounted and CSS shows the right one, so
 * switching the color mode never swaps (and reloads / re-decodes) the image.
 */
export default function NavbarLogo() {
  const isApi = useActivePlugin()?.pluginId === "api"
  const { title, logo: maybeLogo } = useThemeConfig().navbar
  const logo = maybeLogo!
  const lightSrc = useBaseUrl(logo.src)
  const darkSrc = useBaseUrl(logo.srcDark ?? logo.src)
  const homeUrl = useBaseUrl(logo.href ?? "/")

  return (
    <>
      <Link to={homeUrl} className="navbar__brand">
        <div className="navbar__logo">
          <img className={styles.logoLight} src={lightSrc} alt={logo.alt} />
          <img className={styles.logoDark} src={darkSrc} alt={logo.alt} />
        </div>
        {title != null && <b className="navbar__title text--truncate">{title}</b>}
      </Link>
      {isApi && (
        <Link to="/api/" className={styles.apiTag}>
          API
        </Link>
      )}
    </>
  )
}
