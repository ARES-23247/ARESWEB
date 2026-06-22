import React from "react";
import { ChevronDown } from "lucide-react";
import { NavItemConfig } from "./navItems";
import { NavLinkItem } from "./NavLinkItem";

interface NavDropdownProps {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  items: NavItemConfig[];
  onItemClick: () => void;
}

export function NavDropdown({
  label,
  isOpen,
  onToggle,
  items,
  onItemClick,
}: NavDropdownProps) {
  return (
    <div className="relative py-2 group/nav-dropdown">
      <button
        onClick={onToggle}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`flex items-center gap-1.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1 cursor-pointer ${
          isOpen ? "text-ares-gold" : "text-white hover:text-ares-gold"
        }`}
      >
        {label}{" "}
        <ChevronDown
          size={12}
          className={`transition-transform duration-300 ${
            isOpen ? "rotate-180" : "group-hover/nav-dropdown:rotate-180"
          }`}
        />
      </button>
      <div
        className={`absolute top-[calc(100%-4px)] left-0 w-48 bg-obsidian/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-lg p-1 transition-all duration-300 z-50 opacity-0 translate-y-2 pointer-events-none group-hover/nav-dropdown:opacity-100 group-hover/nav-dropdown:translate-y-0 group-hover/nav-dropdown:pointer-events-auto group-focus-within/nav-dropdown:opacity-100 group-focus-within/nav-dropdown:translate-y-0 group-focus-within/nav-dropdown:pointer-events-auto ${
          isOpen ? "!opacity-100 !translate-y-0 !pointer-events-auto" : ""
        }`}
      >
        {items.map((item, index) => (
          <React.Fragment key={index}>
            {item.dividerBefore && <div className="h-px bg-white/5 my-1" />}
            <NavLinkItem
              item={item}
              variant="desktop-dropdown"
              onClick={onItemClick}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
