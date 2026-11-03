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
      viewBox="0 0 246 42"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g>
        <path d="M6 18H18V24H6ZM6 24H18V30H6Z" fill="var(--icon-weak-base)" />
        <path d="M0 0H6V6H24V36H0ZM6 12V30H18V12Z" fill="var(--icon-base)" />
        <path d="M30 6H48V12H36V36H30Z" fill="var(--icon-base)" />
        <path d="M60 24H72V30H60Z" fill="var(--icon-weak-base)" />
        <path d="M54 6H78V36H54V18H72V12H54ZM60 24V30H72V24Z" fill="var(--icon-base)" />
        <path d="M90 18H96V24H90ZM102 18H108V24H102ZM90 24H96V30H90ZM102 24H108V30H102Z" fill="var(--icon-weak-base)" />
        <path d="M84 6H90V30H96V18H102V30H108V6H114V36H84Z" fill="var(--icon-base)" />
        <path d="M120 0H126V36H120Z" fill="var(--icon-base)" />
        <path d="M138 18H156V24H138ZM138 24H156V30H138Z" fill="var(--icon-weak-base)" />
        <path d="M132 6H156V12H138V30H156V36H132Z" fill="var(--icon-strong-base)" />
        <path d="M168 18H180V24H168ZM168 24H180V30H168Z" fill="var(--icon-weak-base)" />
        <path d="M162 6H186V36H162ZM168 12V30H180V12Z" fill="var(--icon-strong-base)" />
        <path d="M198 18H210V24H198ZM198 24H210V30H198Z" fill="var(--icon-weak-base)" />
        <path d="M192 6H210V0H216V36H192ZM198 12V30H210V12Z" fill="var(--icon-strong-base)" />
        <path d="M228 24H246V30H228Z" fill="var(--icon-weak-base)" />
        <path d="M222 6H246V24H228V30H246V36H222ZM228 12V18H240V12Z" fill="var(--icon-strong-base)" />
      </g>
    </svg>
  )
}
