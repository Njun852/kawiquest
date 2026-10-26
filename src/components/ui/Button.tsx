import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Icon, type IconName } from "./Icon";

// Flat, 8px radius, sentence-case labels. One primary button per view.
type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

type Common = {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  /** Icon-only button: the label is kept for screen readers. */
  iconOnly?: boolean;
  children: ReactNode;
  className?: string;
};

function classes(variant: Variant, size: Size, className?: string) {
  return cx("kq-btn", `kq-btn--${variant}`, size !== "md" && `kq-btn--${size}`, className);
}

function Content({ icon, iconOnly, children }: Pick<Common, "icon" | "iconOnly" | "children">) {
  return (
    <>
      {icon && <Icon name={icon} />}
      {iconOnly ? <span className="kq-sr-only">{children}</span> : children}
    </>
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconOnly,
  pending,
  children,
  className,
  type = "button",
  disabled,
  ...rest
}: Common & { pending?: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button
      type={type}
      className={classes(variant, size, className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      title={iconOnly && typeof children === "string" ? children : undefined}
      {...rest}
    >
      <Content icon={icon} iconOnly={iconOnly}>
        {children}
      </Content>
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  icon,
  iconOnly,
  children,
  className,
}: Common & { href: string }) {
  return (
    <Link href={href} className={classes(variant, size, className)}>
      <Content icon={icon} iconOnly={iconOnly}>
        {children}
      </Content>
    </Link>
  );
}

/** 40px square outlined button with a small label under it (canvas Undo / Clear). */
export function IconButton({
  icon,
  children,
  ...rest
}: { icon: IconName; children: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button type="button" className="kq-iconbtn" {...rest}>
      <span>
        <Icon name={icon} />
      </span>
      {children}
    </button>
  );
}
