import { observer } from "mobx-react"
import React from "react"
import { AppInstance } from "./appInstance"

export const App = observer(() => {
  return (
    <>
      <h2>App Instance</h2>
      <AppInstance />
    </>
  )
})
