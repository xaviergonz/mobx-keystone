import * as React from "react"
import check from "./check.svg"

export function CheckIcon(props: { size?: number }) {
  const size = props.size ? props.size : 24
  return (
    <img
      src={check}
      style={{
        width: size,
        display: "inline",
        verticalAlign: "middle",
      }}
    />
  )
}
