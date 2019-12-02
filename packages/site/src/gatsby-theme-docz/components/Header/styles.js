import { media } from "gatsby-theme-docz/src/theme/breakpoints"
import * as mixins from "gatsby-theme-docz/src/utils/mixins"

export const logoContainer = {
  display: "flex",
  alignItems: "center",
}

export const logoTitle = {
  fontSize: "24px",
  fontWeight: 700,
}

export const logoImage = {
  marginRight: 16,
  width: 48,
  height: 48,
}

export const wrapper = {
  bg: "header.bg",
  position: "relative",
  zIndex: 1,
  borderBottom: t => `1px solid ${t.colors.border}`,
}

export const innerContainer = {
  ...mixins.centerAlign,
  px: 4,
  position: "relative",
  justifyContent: "space-between",
  height: 80,
}

export const menuIcon = {
  display: "none",
  position: "absolute",
  top: "calc(100% + 15px)",
  left: 30,
  [media.tablet]: {
    display: "block",
  },
}

export const menuButton = {
  ...mixins.ghostButton,
  color: "header.text",
  opacity: 0.5,
  cursor: "pointer",
}

export const headerButton = {
  ...mixins.centerAlign,
  outline: "none",
  p: "8px",
  border: "none",
  borderRadius: 16,
  bg: "header.button.bg",
  color: "header.button.color",
  fontSize: 0,
  fontWeight: 600,
  cursor: "pointer",
}

export const editButton = {
  ...mixins.centerAlign,
  position: "absolute",
  bottom: -40,
  right: 30,
  bg: "transparent",
  color: "muted",
  fontSize: 1,
  textDecoration: "none",
  borderRadius: "radius",
}
