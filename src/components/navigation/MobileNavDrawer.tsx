import { type RefObject, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { CircleAlert, LayoutDashboard, User as UserIcon, X } from "lucide-react";
import { TEAM_LINKS, RESOURCE_LINKS } from "./navItems";
import { NavLinkItem } from "./NavLinkItem";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface MenuUser {
  uid: string;
  displayName?: string | null;
}

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  isSignedIn: boolean;
  user: MenuUser | null;
  userRole: string;
  userImage: string | null | undefined;
  hasPendingInquiries: boolean;
  pendingInquiriesError?: string | null;
  logout: () => void;
  loginWithGoogle: () => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}

export function MobileNavDrawer({
  isOpen,
  onClose,
  loading,
  isSignedIn,
  user,
  userRole,
  userImage,
  hasPendingInquiries,
  pendingInquiriesError,
  logout,
  loginWithGoogle,
  returnFocusRef,
}: MobileNavDrawerProps) {
  const drawerRef = useFocusTrap(isOpen, onClose);
  const { pathname } = useLocation();
  const previousPathnameRef = useRef(pathname);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen && previousPathnameRef.current !== pathname) {
      onCloseRef.current();
    }
    previousPathnameRef.current = pathname;
  }, [isOpen, pathname]);

  useEffect(() => {
    if (!isOpen) return;

    const closeAtDesktopWidth = () => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        onCloseRef.current();
      }
    };

    window.addEventListener("resize", closeAtDesktopWidth);
    return () => window.removeEventListener("resize", closeAtDesktopWidth);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const portal = document.querySelector<HTMLElement>("[data-mobile-nav-portal]");
    const siblings = Array.from(document.body.children).filter(
      (element): element is HTMLElement => element instanceof HTMLElement && element !== portal,
    );
    const previousBodyOverflow = document.body.style.overflow;
    const previousStates = siblings.map((element) => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute("aria-hidden"),
    }));

    document.body.style.overflow = "hidden";
    for (const element of siblings) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      for (const { element, inert, ariaHidden } of previousStates) {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
      queueMicrotask(() => returnFocusRef?.current?.focus());
    };
  }, [isOpen, returnFocusRef]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div data-mobile-nav-portal className="fixed inset-0 z-[100] md:hidden">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close navigation menu"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/75"
      />
      <div
        ref={drawerRef}
        id="mobile-navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-navigation-title"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-[min(90vw,24rem)] flex-col gap-5 overflow-y-auto border-l border-ares-bronze/30 bg-obsidian p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 id="mobile-navigation-title" className="text-sm font-black uppercase tracking-widest text-white">
            Mobile navigation menu
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="flex h-10 w-10 items-center justify-center rounded border border-white/10 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-ares-gold">
            Team &amp; Organization
          </p>
          <div className="flex flex-col gap-3 pl-2">
            {TEAM_LINKS.map((item) => (
              <NavLinkItem key={item.label} item={item} variant="mobile-drawer" onClick={onClose} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-ares-gold">
            Resources
          </p>
          <div className="flex flex-col gap-3 pl-2">
            {RESOURCE_LINKS.map((item) => (
              <NavLinkItem key={item.label} item={item} variant="mobile-drawer" onClick={onClose} />
            ))}
          </div>
        </div>

        <div className="my-1 h-px bg-white/10" aria-hidden="true" />

        {loading ? (
          <span className="text-xs text-marble/60" role="status">Verifying session...</span>
        ) : isSignedIn && user ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <img
                src={userImage || `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(user.uid)}`}
                alt=""
                className="h-8 w-8 rounded-full border border-ares-bronze/40 bg-black/40"
              />
              <div>
                <p className="text-sm font-bold text-white">{user.displayName || "ARES Member"}</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-ares-gold">{userRole}</p>
              </div>
            </div>
            <Link
              to="/dashboard"
              onClick={onClose}
              className="relative mt-2 flex w-full items-center justify-center gap-2 rounded border border-white/10 bg-white/5 py-2 text-center text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <LayoutDashboard aria-hidden="true" size={12} className="text-ares-gold" /> Command Center
              {hasPendingInquiries && <span className="absolute right-4 top-2 h-2 w-2 rounded-full bg-ares-red" aria-label="Pending inquiries" />}
              {pendingInquiriesError && (
                <CircleAlert
                  aria-label={`Pending inquiry status unavailable: ${pendingInquiriesError}`}
                  className="rounded-full bg-ares-red p-0.5 text-white"
                  size={16}
                />
              )}
            </Link>
            <Link
              to="/dashboard/profile"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded border border-white/10 bg-white/5 py-2 text-center text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <UserIcon aria-hidden="true" size={12} className="text-ares-cyan" /> My Profile
            </Link>
            <button
              type="button"
              onClick={() => {
                logout();
                onClose();
              }}
              className="mt-2 w-full rounded border border-ares-red/40 bg-ares-red/20 py-2 text-center text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-ares-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              loginWithGoogle();
              onClose();
            }}
            className="w-full rounded border border-ares-bronze/30 bg-ares-red py-3 text-center text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-ares-bronze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            Sign In with Google
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
