import React from "react";
import { Link, useLocation } from "react-router-dom";
import { NavItemConfig } from "./navItems";

interface NavLinkItemProps {
  item: NavItemConfig;
  variant: "desktop-dropdown" | "mobile-drawer";
  onClick?: () => void;
}

export function NavLinkItem({ item, variant, onClick }: NavLinkItemProps) {
  const { to, href, icon: Icon, iconColor, label, isAresLib } = item;
  const { pathname } = useLocation();
  const isCurrent = Boolean(
    to && (pathname === to || (to !== "/" && pathname.startsWith(`${to}/`))),
  );

  const className =
    variant === "desktop-dropdown"
      ? "flex items-center gap-2.5 px-3 py-2 text-[10px] text-marble hover:text-white hover:bg-white/5 rounded-md transition-colors font-bold tracking-wider"
      : "flex min-h-11 items-center gap-3 rounded px-2 py-2 text-xs font-bold uppercase tracking-wider text-marble transition-colors hover:bg-white/5 hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan";

  const content = (
    <>
      <Icon aria-hidden="true" size={12} className={iconColor} />
      {isAresLib ? (
        <span>
          <span className="text-ares-red">ARES</span>Lib
        </span>
      ) : (
        label
      )}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        onClick={onClick}
        className={className}
        aria-current={isCurrent ? "page" : undefined}
      >
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a
        href={href}
        onClick={onClick}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {content}
      </a>
    );
  }

  return null;
}
