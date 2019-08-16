import * as React from "react"

export function RedXIcon(props: { size?: number; fill?: string }) {
  const size = props.size ? props.size : 24
  const fill = props.fill ? props.fill : "tomato"
  return (
    <svg
      style={{
        width: size,
        display: "inline",
        verticalAlign: "middle",
        stroke: fill,
      }}
      fill="none"
      viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
      strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
    </svg>
  )
}
