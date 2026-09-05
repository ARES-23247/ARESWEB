import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CircleAlert, LayoutDashboard, LogIn, LogOut, User as UserIcon } from "lucide-react";
import { maskEmail } from "@/lib/utils";
import AuthErrorNotice from "./AuthErrorNotice";

interface MenuUser {
  uid: string;
  displayName?: string | null;
  email?: string | null;
}

interface DesktopUserMenuProps {
  loading: boolean;
  isSignedIn: boolean;
  user: MenuUser | null;
  userRole: string;
  userImage: string | null | undefined;
  hasPendingInquiries: boolean;
  pendingInquiriesError?: string | null;
  logout: () => void;
  loginWithGoogle: () => void;
}

export function DesktopUserMenu({
  loading,
  isSignedIn,
  user,
  userRole,
  userImage,
  hasPendingInquiries,
  pendingInquiriesError,
  logout,
  loginWithGoogle,
}: DesktopUserMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuId = useId();
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuContainerRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMenuOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  if (loading) {
    return (
      <div className="hidden items-center gap-4 xl:flex">
        <span className="text-xs text-marble/60" role="status">Verifying session...</span>
      </div>
    );
  }

  if (!isSignedIn || !user) {
    return (
      <div className="hidden items-center gap-4 xl:flex">
        <button
          type="button"
          onClick={loginWithGoogle}
          className="flex h-9 items-center gap-2 bg-ares-red px-4 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-ares-bronze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          <LogIn aria-hidden="true" size={14} /> Sign In
        </button>
        <AuthErrorNotice />
      </div>
    );
  }

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className="hidden items-center gap-4 xl:flex">
      <div className="flex items-center gap-3">
        <div className="hidden max-w-28 text-right 2xl:block">
          <p className="truncate text-xs font-bold leading-none text-white">
            {user.displayName || "ARES Member"}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-ares-gold">
            {userRole}
          </p>
        </div>

        <div
          ref={menuContainerRef}
          className="relative"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setIsMenuOpen(false);
          }}
        >
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            aria-controls={menuId}
            onClick={() => setIsMenuOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIsMenuOpen(true);
                requestAnimationFrame(() => {
                  menuContainerRef.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus();
                });
              }
            }}
            className="relative flex h-9 items-center gap-2 border border-white/10 bg-white/5 px-3 transition-all hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            <img
              src={userImage || `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(user.uid)}`}
              alt=""
              className="h-6 w-6 rounded-full border border-ares-bronze/40 bg-black/40"
            />
            <span className="hidden text-xs font-bold uppercase tracking-wider text-white sm:inline">Portal</span>
            {hasPendingInquiries && (
              <span className="absolute -right-1 -top-1 z-10 flex h-2.5 w-2.5" aria-label="Pending inquiries">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ares-red opacity-75" aria-hidden="true" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ares-red" aria-hidden="true" />
              </span>
            )}
            {pendingInquiriesError && (
              <CircleAlert
                aria-label={`Pending inquiry status unavailable: ${pendingInquiriesError}`}
                className="ml-1 rounded-full bg-ares-red p-0.5 text-white"
                size={16}
              />
            )}
          </button>

          {isMenuOpen && (
            <div
              id={menuId}
              role="menu"
              aria-label="Portal account"
              onKeyDown={(event) => {
                if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[role='menuitem']"));
                if (items.length === 0) return;
                const currentIndex = items.indexOf(document.activeElement as HTMLElement);
                if (event.key === "Home") items[0].focus();
                else if (event.key === "End") items.at(-1)?.focus();
                else if (event.key === "ArrowDown") items[(currentIndex + 1 + items.length) % items.length].focus();
                else items[(currentIndex - 1 + items.length) % items.length].focus();
              }}
              className="absolute right-0 top-full z-50 mt-2 w-52 rounded-lg border border-ares-bronze/20 bg-obsidian p-2 shadow-2xl"
            >
              <div className="border-b border-white/5 px-3 py-2">
                <p className="text-xs text-marble/60">Signed in as</p>
                <p className="truncate text-xs font-bold text-white">{maskEmail(user.email || "")}</p>
              </div>
              <Link
                to="/dashboard"
                role="menuitem"
                onClick={closeMenu}
                className="mt-1 flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-ares-gold transition-colors hover:bg-ares-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <span className="flex items-center gap-2">
                  <LayoutDashboard aria-hidden="true" size={12} /> Command Center
                </span>
                {hasPendingInquiries && <span className="h-2 w-2 rounded-full bg-ares-red" aria-label="Pending inquiries" />}
              </Link>
              <Link
                to="/dashboard/profile"
                role="menuitem"
                onClick={closeMenu}
                className="mt-1 flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-marble transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <UserIcon aria-hidden="true" size={12} className="text-ares-cyan" /> My Profile
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  logout();
                }}
                className="mt-1 flex w-full items-center gap-2 rounded bg-ares-red/15 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-ares-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <LogOut aria-hidden="true" size={12} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
