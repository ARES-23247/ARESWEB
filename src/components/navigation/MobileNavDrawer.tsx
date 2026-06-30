import { Link } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";
import { TEAM_LINKS, RESOURCE_LINKS } from "./navItems";
import { NavLinkItem } from "./NavLinkItem";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  isSignedIn: boolean;
  user: any;
  userRole: string;
  userImage: string | null | undefined;
  hasPendingInquiries: boolean;
  logout: () => void;
  loginWithGoogle: () => void;
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
  logout,
  loginWithGoogle,
}: MobileNavDrawerProps) {
  const drawerRef = useFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div 
      ref={drawerRef}
      className="absolute top-full left-0 w-full bg-obsidian border-b border-ares-bronze/20 shadow-2xl p-6 flex flex-col gap-5 md:hidden z-50 max-h-[80vh] overflow-y-auto"
    >
      {/* Section 1: Team & Organization */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-ares-bronze mb-2">
          Team & Organization
        </p>
        <div className="flex flex-col gap-3 pl-2">
          {TEAM_LINKS.map((item, index) => (
            <NavLinkItem
              key={index}
              item={item}
              variant="mobile-drawer"
              onClick={onClose}
            />
          ))}
        </div>
      </div>

      {/* Section 2: Resources */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-ares-bronze mb-2">
          Resources
        </p>
        <div className="flex flex-col gap-3 pl-2">
          {RESOURCE_LINKS.map((item, index) => (
            <NavLinkItem
              key={index}
              item={item}
              variant="mobile-drawer"
              onClick={onClose}
            />
          ))}
        </div>
      </div>

      <div className="h-px bg-white/10 my-1"></div>

      {loading ? (
        <span className="text-xs text-marble/60">Verifying session...</span>
      ) : isSignedIn && user ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <img
              src={
                userImage ||
                `https://api.dicebear.com/9.x/bottts/svg?seed=${user.uid}`
              }
              alt=""
              className="w-8 h-8 rounded-full bg-black/40 border border-ares-bronze/40"
            />
            <div>
              <p className="text-sm font-bold text-white">{user.displayName}</p>
              <p className="text-xs text-ares-gold font-semibold uppercase tracking-wider">
                {userRole}
              </p>
            </div>
          </div>
          <Link
            to="/dashboard"
            onClick={onClose}
            className="w-full mt-2 text-center py-2 text-xs text-white bg-white/5 hover:bg-white/10 rounded transition-colors font-bold uppercase tracking-wider border border-white/10 flex items-center justify-center gap-2 cursor-pointer relative"
          >
            <LayoutDashboard size={12} className="text-ares-gold" /> Command Center
            {hasPendingInquiries && (
              <span className="absolute top-2 right-4 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ares-red opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-ares-red"></span>
              </span>
            )}
          </Link>
          <button
            onClick={() => {
              logout();
              onClose();
            }}
            className="w-full mt-2 text-center py-2 text-xs text-white bg-ares-red/20 hover:bg-ares-red text-ares-danger hover:text-white rounded transition-colors font-bold uppercase tracking-wider border border-ares-red/30 cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            loginWithGoogle();
            onClose();
          }}
          className="w-full text-center py-3 bg-ares-red hover:bg-ares-red-dark text-white rounded transition-all font-bold uppercase tracking-widest text-xs border border-ares-bronze/20 cursor-pointer"
        >
          Sign In with Google
        </button>
      )}
    </div>
  );
}
