import React from "react"
import { AppInstance } from "./appInstance"

export default function App() {
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
