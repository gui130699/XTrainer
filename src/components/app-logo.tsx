import Image from "next/image";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function AppLogo({ size = 44 }: { size?: number }) {
  return <span className="app-logo">
    <Image
      className="app-logo-icon"
      src={`${basePath}/xtrainer-user-icon-192.png`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      priority
      unoptimized
    />
    <span className="app-logo-wordmark">X<span>Trainer</span></span>
  </span>;
}
