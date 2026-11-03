import { createUniqueId, type ComponentProps } from "solid-js"

export function Wordmark(
  props: Pick<ComponentProps<"svg">, "class"> & { fade?: boolean; muted?: boolean; outline?: boolean },
) {
  const mask = createUniqueId()
  const maskGradient = createUniqueId()

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 720 122.9268"
      fill="none"
      classList={{
        [props.class ?? ""]: !!props.class,
        "overflow-visible [&_path]:[vector-effect:non-scaling-stroke]": props.outline,
      }}
    >
      <g opacity={props.muted === false ? 1 : 0.6} class="[[data-color-scheme=dark]_&]:opacity-100">
        <g mask={props.fade === false ? undefined : `url(#${mask})`}>
          <g
            opacity={props.muted === false ? 1 : 0.16 * 0.7}
            fill={props.outline ? "none" : "currentColor"}
            stroke={props.outline ? "currentColor" : undefined}
            stroke-width={props.outline ? 1 : undefined}
          >
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M0 0H17.561V17.561H70.2439V105.3659H0ZM17.561 35.122V87.8049H52.6829V35.122Z"
            />
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M87.8049 17.561H140.4878V35.122H105.3659V105.3659H87.8049Z"
            />
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M158.0488 17.561H228.2927V105.3659H158.0488V52.6829H210.7317V35.122H158.0488ZM175.6098 70.2439V87.8049H210.7317V70.2439Z"
            />
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M245.8537 17.561H263.4146V87.8049H280.9756V52.6829H298.5366V87.8049H316.0976V17.561H333.6585V105.3659H245.8537Z"
            />
            <path pathLength={props.outline ? 1 : undefined} d="M351.2195 0H368.7805V105.3659H351.2195Z" />
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M386.3415 17.561H456.5854V35.122H403.9024V87.8049H456.5854V105.3659H386.3415Z"
            />
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M474.1463 17.561H544.3902V105.3659H474.1463ZM491.7073 35.122V87.8049H526.8293V35.122Z"
            />
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M561.9512 17.561H614.6341V0H632.1951V105.3659H561.9512ZM579.5122 35.122V87.8049H614.6341V35.122Z"
            />
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M649.7561 17.561H720V70.2439H667.3171V87.8049H720V105.3659H649.7561ZM667.3171 35.122V52.6829H702.439V35.122Z"
            />
          </g>
        </g>
      </g>
      <defs>
        <mask id={mask} style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="720" height="122.9268">
          <rect width="720" height="122.9268" fill={`url(#${maskGradient})`} />
        </mask>
        <linearGradient id={maskGradient} x1="360" y1="64.7986" x2="360" y2="122.9268" gradientUnits="userSpaceOnUse">
          <stop stop-color="white" stop-opacity="0.7" />
          <stop offset="1" stop-color="white" stop-opacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}
