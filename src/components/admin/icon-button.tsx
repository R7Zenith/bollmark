import { forwardRef } from "react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import Link from "next/link";

const baseClasses =
  "inline-flex h-8 w-8 md:h-8 md:w-8 items-center justify-center rounded-md border border-admin-border text-admin-text-muted transition-colors hover:bg-admin-bg hover:text-admin-accent disabled:opacity-40 disabled:pointer-events-none";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
  "aria-label"?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className = "", title, "aria-label": ariaLabel, ...props }, ref) => {
    return (
      <button
        ref={ref}
        title={title}
        aria-label={ariaLabel ?? title}
        className={`${baseClasses} ${className}`}
        {...props}
      />
    );
  }
);
IconButton.displayName = "IconButton";

interface IconLinkButtonProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  title: string;
  "aria-label"?: string;
  disabled?: boolean;
}

export const IconLinkButton = forwardRef<HTMLAnchorElement, IconLinkButtonProps>(
  ({ className = "", title, "aria-label": ariaLabel, disabled, href, onClick, ...props }, ref) => {
    if (disabled) {
      return (
        <span
          title={title}
          aria-label={ariaLabel ?? title}
          aria-disabled="true"
          className={`${baseClasses} opacity-40 pointer-events-none ${className}`}
        >
          {props.children}
        </span>
      );
    }
    return (
      <Link
        ref={ref}
        href={href}
        title={title}
        aria-label={ariaLabel ?? title}
        onClick={onClick}
        className={`${baseClasses} ${className}`}
        {...props}
      />
    );
  }
);
IconLinkButton.displayName = "IconLinkButton";
