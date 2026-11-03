import { Link, Meta } from "@solidjs/meta"

export const Favicon = () => {
  return (
    <>
      <Link rel="icon" type="image/png" href="/brawl-favicon-96x96.png" sizes="96x96" />
      <Link rel="shortcut icon" href="/brawl-favicon.ico" />
      <Link rel="apple-touch-icon" sizes="180x180" href="/brawl-apple-touch-icon.png" />
      <Link rel="manifest" href="/site.webmanifest" />
      <Meta name="apple-mobile-web-app-title" content="Brawl Code" />
    </>
  )
}
