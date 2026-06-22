import { Link } from "react-router-dom";
import { LogIn, LogOut, User as UserIcon, LayoutDashboard } from "lucide-react";
import { maskEmail } from "@/lib/utils";

interface DesktopUserMenuProps {
  loading: boolean;
  isSignedIn: boolean;
  user: any;
  userRole: string;
  userImage: string | null | undefined;
  hasPendingInquiries: boolean;
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
  logout,
  loginWithGoogle,
}: DesktopUserMenuProps) {
  if (loading) {
    return (
      <div className="hidden md:flex items-center gap-4">
        <span className="text-xs text-marble/60">Verifying session...</span>
      </div>
    );
  }

  if (!isSignedIn || !user) {
    return (
      <div className="hidden md:flex items-center gap-4">
        <button
          onClick={loginWithGoogle}
          className="flex items-center gap-2 px-4 h-9 bg-ares-red hover:bg-ares-red-dark text-white border border-white/10 ares-cut-sm transition-all font-bold uppercase tracking-widest text-xs cursor-pointer"
        >
          <LogIn size={14} /> Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="hidden md:flex items-center gap-4">
      <div className="flex items-center gap-3">
        <div className="text-right hidden lg:block">
          <p className="text-xs font-bold text-white leading-none">
            {user.displayName || "ARES Member"}
          </p>
          <p className="text-[10px] text-ares-gold uppercase tracking-wider font-semibold mt-1">
            {userRole}
          </p>
        </div>

        <div className="relative group">
          <button className="relative flex items-center gap-2 px-3 h-9 bg-white/5 hover:bg-white/10 border border-white/10 ares-cut-sm transition-all cursor-pointer">
            <img
              src={userImage || `https://api.dicebear.com/9.x/bottts/svg?seed=${user.uid}`}
              alt=""
              className="w-6 h-6 rounded-full bg-black/40 border border-ares-bronze/40"
            />
            <span className="text-xs font-bold text-white uppercase tracking-wider hidden sm:inline">Portal</span>
            {hasPendingInquiries && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 z-10">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ares-red opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ares-red"></span>
              </span>
            )}
          </button>
          <div className="absolute right-0 top-full mt-2 w-48 bg-obsidian border border-ares-bronze/20 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 p-2">
            <div className="px-3 py-2 border-b border-white/5">
              <p className="text-xs text-marble/60">Logged in as</p>
              <p className="text-xs font-bold text-white truncate">{maskEmail(user.email)}</p>
            </div>
            <Link
              to="/dashboard"
              className="w-full text-left mt-1 px-3 py-2 text-xs text-ares-gold hover:bg-ares-gold/10 rounded transition-colors font-bold uppercase tracking-wider flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <LayoutDashboard size={12} /> Command Center
              </div>
              {hasPendingInquiries && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ares-red opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-ares-red"></span>
                </span>
              )}
            </Link>
            <Link
              to="/dashboard/profile"
              className="w-full text-left block mt-1 px-3 py-2 text-xs text-marble hover:bg-white/5 rounded transition-colors font-bold uppercase tracking-wider flex items-center gap-2"
            >
              <UserIcon size={12} className="text-ares-cyan" /> My Profile
            </Link>
            <button
              onClick={logout}
              className="w-full text-left mt-1 px-3 py-2 text-xs text-ares-danger hover:bg-ares-red/10 rounded transition-colors flex items-center gap-2 font-bold uppercase tracking-wider cursor-pointer"
            >
              <LogOut size={12} /> Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
