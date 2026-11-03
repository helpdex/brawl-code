import { type ComponentProps } from "solid-js"

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 16 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        data-slot="logo-logo-mark-o"
        d="M5.3 2.5H9.5L4.4 17.5H0.2ZM11.8 2.5H16L10.9 17.5H6.7Z"
        fill="var(--icon-strong-base)"
      />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M26.5 12.5H47.5L22 87.5H1ZM59 12.5H80L54.5 87.5H33.5Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 196 42"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <rect width="42" height="42" rx="11" fill="#FF5A1F" />
      <path d="M17.5 9.8H23.8L16.1 32.2H9.8ZM27.3 9.8H33.6L25.9 32.2H19.6Z" fill="#0B0B0D" />
      <text
        x="54"
        y="29.5"
        font-size="24"
        font-weight="600"
        letter-spacing="-0.5"
        style={{ "font-family": "var(--font-family-sans)" }}
        fill="var(--icon-strong-base)"
      >
        Brawl Code
      </text>
    </svg>
  )
}
