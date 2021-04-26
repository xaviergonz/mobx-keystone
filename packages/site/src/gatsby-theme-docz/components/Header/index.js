/** @jsx jsx */
import { useConfig, useCurrentDoc } from "docz"
import { Code, Edit, Github, Menu, Sun } from "gatsby-theme-docz/src/components/Icons"
import { default as Package } from "react-feather/dist/icons/package"
import { Box, Flex, jsx, useColorMode } from "theme-ui"
import logoImage from "./lib-logo.png"
import * as styles from "./styles"

const headerButtonStyle = {
  backgroundColor: "#0085f9",
  paddingLeft: 16,
  paddingRight: 16,
  borderRadius: 8,
}

export const Header = (props) => {
  const { onOpen } = props
  const {
    title,
    repository,
    npm,
    apiRef,
    themeConfig: { showDarkModeSwitch, showMarkdownEditButton },
  } = useConfig()
  const { edit = true, ...doc } = useCurrentDoc()
  const [colorMode, setColorMode] = useColorMode()

  const toggleColorMode = () => {
    setColorMode(colorMode === "light" ? "dark" : "light")
  }

  return (
    <div sx={styles.wrapper} data-testid="header">
      <Box sx={styles.menuIcon}>
        <button sx={styles.menuButton} onClick={onOpen}>
          <Menu size={25} />
        </button>
      </Box>
      <div sx={styles.innerContainer}>
        <div sx={styles.logoContainer}>
          <img sx={styles.logoImage} src={logoImage} alt="Logo" />
          <span sx={styles.logoTitle}>{title}</span>
        </div>
        <Flex>
          {apiRef && (
            <Box sx={{ mr: 2 }}>
              <a
                href={apiRef}
                sx={styles.headerButton}
                style={headerButtonStyle}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>API Ref</span> <Code style={{ marginLeft: 8 }} size={15} />
              </a>
            </Box>
          )}
          {npm && (
            <Box sx={{ mr: 2 }}>
              <a
                href={npm}
                sx={styles.headerButton}
                style={headerButtonStyle}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>NPM</span> <Package style={{ marginLeft: 8 }} size={15} />
              </a>
            </Box>
          )}
          {repository && (
            <Box sx={{ mr: 2 }}>
              <a
                href={repository}
                sx={styles.headerButton}
                style={headerButtonStyle}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>GitHub</span> <Github style={{ marginLeft: 8 }} size={15} />
              </a>
            </Box>
          )}
          {showDarkModeSwitch && (
            <button sx={styles.headerButton} onClick={toggleColorMode}>
              <Sun size={15} />
            </button>
          )}
        </Flex>
        {showMarkdownEditButton && edit && doc.link && (
          <a sx={styles.editButton} href={doc.link} target="_blank" rel="noopener noreferrer">
            <Edit width={14} />
            <Box sx={{ pl: 2 }}>Edit page</Box>
          </a>
        )}
      </div>
    </div>
  )
}
