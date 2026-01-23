import React from "react"
import { AppInstance } from "./appInstance"

let iframeResizerChildInited = false

function initIframeResizerChild() {
  if (!iframeResizerChildInited) {
    iframeResizerChildInited = true
    void import("@iframe-resizer/child")
  }
}

export const App = () => {
  initIframeResizerChild()

  return (
    <div style={{ display: "flex" }}>
      <div style={{ flex: "0 0 50%", padding: "10px", borderRight: "1px solid #ccc" }}>
        <AppInstance />
      </div>
      <div style={{ flex: "0 0 50%", padding: "10px" }}>
        <AppInstance />
      </div>
    </div>
  )
}
