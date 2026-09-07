import Image from "next/image";
import Link from "next/link";

const ASPECT_RATIO = 1400 / 273;

interface LogoProps {
  variant?: "dark" | "light";
  height?: number;
  href?: string | null;
  className?: string;
}

export function Logo({ variant = "dark", height = 24, href = "/admin", className }: LogoProps) {
  const src = variant === "light" ? "/logo-white.png" : "/logo.png";
  const width = Math.round(height * ASPECT_RATIO);

  const image = (
    <Image
      src={src}
      alt="Bollmark"
      width={width}
      height={height}
      priority
      className={className}
    />
  );

  if (!href) {
    return image;
  }

  return (
    <Link href={href} aria-label="Bollmark yönetim paneline dön">
      {image}
    </Link>
  );
}
