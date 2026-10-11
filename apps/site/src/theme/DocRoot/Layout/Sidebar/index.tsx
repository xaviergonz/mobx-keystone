import { useDocsSidebar } from "@docusaurus/plugin-content-docs/client"
import { useLocation } from "@docusaurus/router"
import { prefersReducedMotion, ThemeClassNames } from "@docusaurus/theme-common"
import type { Props } from "@theme/DocRoot/Layout/Sidebar"
import ExpandButton from "@theme/DocRoot/Layout/Sidebar/ExpandButton"
import DocSidebar from "@theme/DocSidebar"
import {
  Fragment,
  type ReactNode,
  type TransitionEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { clsx } from "../../../../utils/clsx"
import styles from "./styles.module.css"

interface ScrollAnchor {
  element: Element
  top: number
}

/**
 * Finds the first block of the main content that starts inside the viewport, so the reading position
 * can be kept while the content column changes width. Blocks cut off by the top edge are looked into
 * rather than used, since they may re-wrap above it.
 */
function findScrollAnchor(): ScrollAnchor | null {
  const main = document.querySelector("main")
  if (!main || window.scrollY <= 0) {
    return null
  }

  const navbarBottom = document.querySelector(".navbar")?.getBoundingClientRect().bottom ?? 0
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      const element = node as Element
      const { top, bottom, width, height } = element.getBoundingClientRect()
      // Boxless elements (e.g. display: contents) still have children worth looking into.
      if (width === 0 && height === 0) {
        return NodeFilter.FILTER_SKIP
      }
      if (bottom <= navbarBottom) {
        return NodeFilter.FILTER_REJECT
      }
      if (top < navbarBottom) {
        return NodeFilter.FILTER_SKIP
      }
      // Inline elements move when their paragraph re-wraps, and sticky ones do not scroll at all.
      const { display, position } = getComputedStyle(element)
      return display === "inline" || position === "sticky" || position === "fixed"
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT
    },
  })

  const element = walker.nextNode() as Element | null
  if (!element) {
    return null
  }
  const { top } = element.getBoundingClientRect()
  return top < window.innerHeight ? { element, top } : null
}

// Remounts the sidebar when it changes, to reset its state (see facebook/docusaurus#3414).
function ResetOnSidebarChange({ children }: { children: ReactNode }) {
  const sidebar = useDocsSidebar()
  return <Fragment key={sidebar?.name ?? "noSidebar"}>{children}</Fragment>
}

/**
 * Replaces Docusaurus's version, which animates the sidebar width: that re-wraps the content on every
 * frame and makes the text jump up and down. Here the layout switches in a single step, the scroll
 * position is corrected so the text being read stays in place, and only the panel slides, while the
 * expand strip fades in or out.
 */
export default function DocRootLayoutSidebar({
  sidebar,
  hiddenSidebarContainer,
  setHiddenSidebarContainer,
}: Props) {
  const { pathname } = useLocation()
  // Set once the panel has slid out, to take it out of the tab order.
  const [panelHidden, setPanelHidden] = useState(false)
  const scrollAnchor = useRef<ScrollAnchor | null>(null)

  const toggleSidebar = () => {
    scrollAnchor.current = findScrollAnchor()
    // Without motion there is no transition to wait for.
    setPanelHidden(!hiddenSidebarContainer && prefersReducedMotion())
    setHiddenSidebarContainer((hidden) => !hidden)
  }

  const onPanelTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.propertyName === "transform" && hiddenSidebarContainer) {
      setPanelHidden(true)
    }
  }

  // Runs after the content column changed width but before it is painted.
  useLayoutEffect(() => {
    const anchor = scrollAnchor.current
    scrollAnchor.current = null
    if (!anchor?.element.isConnected) {
      return
    }
    const shift = anchor.element.getBoundingClientRect().top - anchor.top
    if (shift !== 0) {
      // Instant, so the text does not visibly jump and scroll back.
      window.scrollBy({ top: shift, behavior: "instant" })
    }
  }, [hiddenSidebarContainer])

  return (
    <aside
      className={clsx(
        ThemeClassNames.docs.docSidebarContainer,
        styles.container,
        hiddenSidebarContainer && styles.containerHidden
      )}
    >
      <ResetOnSidebarChange>
        <div className={styles.viewport}>
          <div className={styles.panel} onTransitionEnd={onPanelTransitionEnd}>
            <DocSidebar
              sidebar={sidebar}
              path={pathname}
              onCollapse={toggleSidebar}
              isHidden={panelHidden}
            />
          </div>
          <div className={styles.expandStrip} inert={!hiddenSidebarContainer}>
            <ExpandButton toggleSidebar={toggleSidebar} />
          </div>
        </div>
      </ResetOnSidebarChange>
    </aside>
  )
}
