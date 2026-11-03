import { type ComponentProps } from "solid-js"

export function Wordmark(
  props: Pick<ComponentProps<"svg">, "class"> & { fade?: boolean; muted?: boolean; outline?: boolean },
) {
  const length = () => (props.outline ? 1 : undefined)

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 300 100"
      fill="none"
      classList={{
        [props.class ?? ""]: !!props.class,
        "overflow-visible [&_path]:[vector-effect:non-scaling-stroke]": props.outline,
      }}
    >
      <g opacity={props.muted === false ? 1 : 0.6}>
        <path
          pathLength={length()}
          d="M137 0H163A15 15 0 0 1 178 15V41A15 15 0 0 1 163 56H137A15 15 0 0 1 122 41V15A15 15 0 0 1 137 0Z"
          fill={props.outline ? "none" : "#FF5A1F"}
          stroke={props.outline ? "currentColor" : undefined}
          stroke-width={props.outline ? 1 : undefined}
        />
        <path
          pathLength={length()}
          d="M145.33 13.07H153.73L143.47 42.93H135.07ZM158.4 13.07H166.8L156.53 42.93H148.13Z"
          fill={props.outline ? "none" : "#0B0B0D"}
          stroke={props.outline ? "currentColor" : undefined}
          stroke-width={props.outline ? 1 : undefined}
        />
        <text
          x="150"
          y="94"
          text-anchor="middle"
          font-size="30"
          font-weight="600"
          letter-spacing="-0.6"
          style={{ "font-family": "var(--font-family-sans)" }}
          fill={props.outline ? "none" : "var(--v2-text-text-base)"}
          stroke={props.outline ? "currentColor" : undefined}
          stroke-width={props.outline ? 0.6 : undefined}
        >
          Brawl Code
        </text>
      </g>
    </svg>
  )
}
