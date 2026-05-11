import { Link } from "@tanstack/react-router";
import { Search, LayoutDashboard, LogIn, X, Home, Users, Trophy, Target, Calendar, BookOpen, GraduationCap, ShoppingBag, Heart, UserPlus } from "lucide-react";
import type { DashboardSession } from "../../hooks/useDashboardSession";
import { Drawer } from "vaul";
import { GreekMeander } from "../GreekMeander";

interface NavbarMobileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: DashboardSession | null;
  isPending: boolean;
}

export function NavbarMobileMenu({ open, onOpenChange, session, isPending }: NavbarMobileMenuProps) {
  const isSignedIn = !isPending && session?.authenticated;
  const handleNavClick = () => onOpenChange(false);

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]" onClick={() => onOpenChange(false)} />
        <Drawer.Content className="bg-obsidian flex flex-col h-[90vh] fixed bottom-0 left-0 right-0 z-[101] border-t border-white/10 outline-none">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Handle */}
            <div className="mx-auto w-12 h-1.5 rounded-full bg-white/20 mt-4 mb-2" />

            {/* Header */}
            <div className="px-8 py-6 flex items-center justify-between border-b border-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
                <GreekMeander variant="thin" />
              </div>
              <div className="relative z-10 flex items-center gap-3">
                <div className="w-10 h-10 bg-ares-red flex items-center justify-center ares-cut-sm shadow-lg">
                  <Home size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tighter uppercase">Navigation</h2>
                  <p className="text-[10px] text-marble/60 font-bold uppercase tracking-[0.2em]">ARES Web Portal</p>
                </div>
              </div>
              <button 
                onClick={() => onOpenChange(false)}
                className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 ares-cut-sm text-marble hover:text-white transition-colors relative z-10"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Trigger */}
            <div className="px-8 py-4">
              <button
                onClick={() => {
                  onOpenChange(false);
                  window.dispatchEvent(new CustomEvent("open-command-palette"));
                }}
                className="w-full h-12 bg-white/5 border border-white/10 ares-cut-sm flex items-center gap-3 px-4 text-marble/60 hover:text-white hover:bg-white/10 transition-all"
              >
                <Search size={18} />
                <span className="text-sm font-bold uppercase tracking-widest">Search Command Palette</span>
              </button>
            </div>

            {/* Nav Links */}
            <div className="px-8 py-4 space-y-1">
              <NavGroup title="Team Info">
                <MobileNavLink to="/about" icon={<Users size={18} />} label="Who We Are" onClick={handleNavClick} />
                <MobileNavLink to="/seasons" icon={<Trophy size={18} />} label="Seasons & Legacy" onClick={handleNavClick} />
                <MobileNavLink to="/outreach" icon={<Target size={18} />} label="Our Impact" onClick={handleNavClick} />
              </NavGroup>

              <NavGroup title="Resources">
                <MobileNavLink to="/events" icon={<Calendar size={18} />} label="Team Calendar" onClick={handleNavClick} color="text-ares-gold" />
                <MobileNavLink to="/blog" icon={<BookOpen size={18} />} label="Team Blog" onClick={handleNavClick} color="text-ares-gold" />
                <MobileNavLink to="/academy" icon={<GraduationCap size={18} />} label="ARES Academy" onClick={handleNavClick} color="text-ares-cyan" />
                <MobileNavLink to="/docs" icon={<BookOpen size={18} />} label="ARES Lib (Docs)" onClick={handleNavClick} color="text-ares-red" />
              </NavGroup>

              <NavGroup title="Support Us">
                <MobileNavLink to="/store" icon={<ShoppingBag size={18} />} label="Merch Store" onClick={handleNavClick} />
                <MobileNavLink to="/sponsors" icon={<Heart size={18} />} label="Our Sponsors" onClick={handleNavClick} />
                <MobileNavLink to="/join" icon={<UserPlus size={18} />} label="Join the Team" onClick={handleNavClick} color="text-ares-cyan" />
              </NavGroup>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-8 bg-black/40 border-t border-white/10 mt-auto">
            {isSignedIn ? (
              <Link
                to="/dashboard"
                onClick={handleNavClick}
                className="flex items-center justify-between w-full p-4 bg-ares-red text-white font-black uppercase tracking-widest ares-cut-sm shadow-xl hover:brightness-110 transition-all"
              >
                <div className="flex items-center gap-3">
                  <LayoutDashboard size={20} />
                  <span>Go to Dashboard</span>
                </div>
              </Link>
            ) : !isPending && (
              <Link
                to="/login"
                onClick={handleNavClick}
                className="flex items-center justify-between w-full p-4 bg-white/10 text-white font-black uppercase tracking-widest ares-cut-sm border border-white/10 hover:bg-white/20 transition-all"
              >
                <div className="flex items-center gap-3">
                  <LogIn size={20} className="text-ares-gold" />
                  <span>Internal Portal Login</span>
                </div>
              </Link>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function NavGroup({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="py-4">
      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-marble/40 mb-3 px-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function MobileNavLink({ to, icon, label, onClick, color = "text-white" }: { to: string, icon: React.ReactNode, label: string, onClick: () => void, color?: string }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-4 px-4 py-3 bg-white/0 hover:bg-white/5 rounded-lg transition-colors group"
    >
      <div className={`${color} opacity-60 group-hover:opacity-100 transition-opacity`}>
        {icon}
      </div>
      <span className="text-base font-bold text-marble/90 group-hover:text-white transition-colors italic tracking-tight">
        {label}
      </span>
    </Link>
  );
}


