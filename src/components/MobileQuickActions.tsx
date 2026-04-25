import { Drawer } from "vaul";
import { Link } from "react-router-dom";
import { User, Target, BookOpen, MessageSquare, Terminal, Settings, LayoutDashboard } from "lucide-react";
import { useUIStore } from "../store/uiStore";

export default function MobileQuickActions() {
  const { isSidebarOpen, setSidebarOpen } = useUIStore();

  const links = [
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={20} /> },
    { label: "Profile", href: "/dashboard/profile", icon: <User size={20} /> },
    { label: "Outreach", href: "/dashboard/outreach", icon: <Target size={20} /> },
    { label: "ARESLib", href: "/docs", icon: <BookOpen size={20} /> },
    { label: "Inquiries", href: "/dashboard/inquiries", icon: <MessageSquare size={20} /> },
    { label: "Admin", href: "/judges", icon: <Terminal size={20} /> },
    { label: "Settings", href: "/dashboard/settings", icon: <Settings size={20} /> },
  ];

  return (
    <Drawer.Root open={isSidebarOpen} onOpenChange={setSidebarOpen}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm" />
        <Drawer.Content className="bg-obsidian flex flex-col h-[60vh] mt-24 fixed bottom-0 left-0 right-0 z-[101] border-t border-white/10 outline-none ring-1 ring-white/5">
          <div className="p-4 bg-white/5 flex-1 overflow-y-auto">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-white/20 mb-8" />
            <div className="max-w-md mx-auto">
              <Drawer.Title className="font-black text-2xl mb-6 text-white uppercase tracking-tighter flex items-center gap-3">
                <div className="w-2 h-8 bg-ares-red ares-cut-sm" />
                Quick Commands
              </Drawer.Title>
              <div className="grid grid-cols-2 gap-4">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setSidebarOpen(false)}
                    className="flex flex-col items-center justify-center p-6 bg-white/5 border border-white/5 ares-cut-lg hover:bg-ares-red/10 hover:border-ares-red/20 transition-all group"
                  >
                    <div className="text-marble/40 group-hover:text-ares-red mb-3 transition-colors">
                      {link.icon}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-marble group-hover:text-white transition-colors">
                      {link.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
