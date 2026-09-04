import React, { useId, useRef } from "react";
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
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div
      className="relative py-2"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onItemClick();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          event.preventDefault();
          event.stopPropagation();
          onItemClick();
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        aria-controls={menuId}
        aria-expanded={isOpen}
        className={`flex items-center gap-1.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1 cursor-pointer ${
          isOpen ? "text-ares-gold" : "text-white hover:text-ares-gold"
        }`}
      >
        {label}{" "}
        <ChevronDown
          size={12}
          className={`transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        id={menuId}
        hidden={!isOpen}
        className="absolute top-[calc(100%-4px)] left-0 w-48 bg-obsidian/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-lg p-1 z-50"
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
