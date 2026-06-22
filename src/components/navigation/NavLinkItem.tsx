import React from "react";
import { Link } from "react-router-dom";
import { NavItemConfig } from "./navItems";

interface NavLinkItemProps {
  item: NavItemConfig;
  variant: "desktop-dropdown" | "mobile-drawer";
  onClick?: () => void;
}

export function NavLinkItem({ item, variant, onClick }: NavLinkItemProps) {
  const { to, href, icon: Icon, iconColor, label, isAresLib } = item;

  const className =
    variant === "desktop-dropdown"
      ? "flex items-center gap-2.5 px-3 py-2 text-[10px] text-marble hover:text-white hover:bg-white/5 rounded-md transition-colors font-bold tracking-wider"
      : "text-marble hover:text-ares-gold transition-colors font-bold uppercase tracking-wider text-xs flex items-center gap-2";

  const content = (
    <>
      <Icon size={12} className={iconColor} />
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
      <Link to={to} onClick={onClick} className={className}>
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
