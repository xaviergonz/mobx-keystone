import { ThemeClassNames } from "@docusaurus/theme-common"
import { useNavbarSecondaryMenu } from "@docusaurus/theme-common/internal"
import type { Props } from "@theme/Navbar/MobileSidebar/Layout"
import { clsx } from "../../../../utils/clsx"
import styles from "./styles.module.css"

/**
 * Shows the docs sidebar and the navbar items in a single panel, instead of
 * hiding the navbar items behind a "Back to main menu" button.
 */
export default function NavbarMobileSidebarLayout({ header, primaryMenu }: Props) {
  // The secondary menu's content alone, without its back button.
  const { content: secondaryMenu } = useNavbarSecondaryMenu()

  return (
    <div className={clsx(ThemeClassNames.layout.navbar.mobileSidebar.container, "navbar-sidebar")}>
      {header}
      <div className="navbar-sidebar__items">
        <div
          className={clsx(
            ThemeClassNames.layout.navbar.mobileSidebar.panel,
            "navbar-sidebar__item menu"
          )}
        >
          {secondaryMenu}
          {secondaryMenu && <hr className={styles.divider} />}
          {primaryMenu}
        </div>
      </div>
    </div>
  )
}
