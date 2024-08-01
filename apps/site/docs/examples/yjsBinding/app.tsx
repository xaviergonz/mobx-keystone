import { observer } from "mobx-react"
import { AppInstance } from "./appInstance"

let iframeResizerChildInited = false

function initIframeResizerChild() {
  if (!iframeResizerChildInited) {
    iframeResizerChildInited = true
    void import("@iframe-resizer/child")
  }
}

export const App = observer(() => {
  initIframeResizerChild()

  return (
    <>
      <div
        style={{
          // to avoid the iframe end from being cut off
          paddingBottom: 8,
        }}
      >
        <h2>App Instance</h2>
        <AppInstance />
      </div>
    </>
  )
})
