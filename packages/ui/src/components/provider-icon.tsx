import type { Component, JSX } from "solid-js"
import { createMemo, splitProps } from "solid-js"
import sprite from "./provider-icons/sprite.svg"
import { iconNames, type IconName } from "./provider-icons/types"

export type ProviderIconProps = JSX.SVGElementTags["svg"] & {
  id: string
}

export const ProviderIcon: Component<ProviderIconProps> = (props) => {
  const [local, rest] = splitProps(props, ["id", "class", "classList"])
  const resolved = createMemo(() => (iconNames.includes(local.id as IconName) ? local.id : "synthetic"))

  return (
    <svg
      data-component="provider-icon"
      {...rest}
      viewBox={local.id === "brawl" ? "0 0 30 30" : undefined}
      classList={{
        ...local.classList,
        [local.class ?? ""]: !!local.class,
      }}
    >
      {local.id === "brawl" ? (
        <path d="M12.5 7H17L11.5 23H7ZM19.5 7H24L18.5 23H14Z" fill="currentColor" />
      ) : (
        <use href={`${sprite}#${resolved()}`} />
      )}
    </svg>
  )
}
