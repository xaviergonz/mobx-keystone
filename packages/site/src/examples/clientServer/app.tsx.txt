import { observer } from "mobx-react"
import React from "react"
import { AppInstance } from "./appInstance"

// we will expose both app instances in the ui

export const App = observer(() => {
  return (
    <div style={{ display: "flex", flexDirection: "row" }}>
      <div style={{ flex: "1 1 0" }}>
        <h2>App Instance #1</h2>
        <AppInstance />
      </div>

      <div style={{ flex: "1 1 0" }}>
        <h2>App Instance #2</h2>
        <AppInstance />
      </div>
    </div>
  )
})
