import * as React from "react"

export function ArrowUpIcon(props: { size?: number; fill?: string }) {
  const size = props.size ? props.size : 24
  const fill = props.fill ? props.fill : "#41ad49"
  return (
    <svg
      style={{
        width: size,
        display: "inline",
        verticalAlign: "middle",
        fill: fill,
      }}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M413.1 327.3l-1.8-2.1-136-156.5c-4.6-5.3-11.5-8.6-19.2-8.6-7.7 0-14.6 3.4-19.2 8.6L101 324.9l-2.3 2.6C97 330 96 333 96 336.2c0 8.7 7.4 15.8 16.6 15.8h286.8c9.2 0 16.6-7.1 16.6-15.8 0-3.3-1.1-6.4-2.9-8.9z" />
    </svg>
  )
}
