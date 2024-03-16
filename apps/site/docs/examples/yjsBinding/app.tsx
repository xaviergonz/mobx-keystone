import { observer } from "mobx-react"
import { AppInstance } from "./appInstance"

export const App = observer(() => {
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
