import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { useDashboardSession } from "../hooks/useDashboardSession";
import { useDashboardNotifications } from "../hooks/useDashboardNotifications";
import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import DashboardRoutes from "../components/dashboard/DashboardRoutes";
import { api } from "../api/client";

export default function Dashboard() {
  const { session, isPending, permissions } = useDashboardSession();
  
  // Lift common dashboard queries to the top level to prevent waterfalls
  // We use parallel queries here so they all start at the same time
  const notifications = useDashboardNotifications(session, permissions);
  
  const { data: statsRes } = api.analytics.getStats.useQuery(
    ["dashboard-stats-shared"], 
    {}, 
    { 
      staleTime: 1000 * 60 * 5, // 5 minutes
      // We don't wait for session here to avoid waterfall; the server will handle auth
    }
  );

  const stats = {
    posts: statsRes?.status === 200 ? statsRes.body.posts : 0,
    events: statsRes?.status === 200 ? statsRes.body.events : 0,
    docs: statsRes?.status === 200 ? statsRes.body.docs : 0,
    integrations: statsRes?.status === 200 ? statsRes.body.integrations : {
      zulip: false,
      github: false,
      discord: false,
      bluesky: false,
      slack: false,
      gcal: false
    }
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-screen bg-obsidian">
        <div className="flex flex-col items-center gap-4">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
            <RefreshCw size={32} className="text-ares-cyan" />
          </motion.div>
          <span className="text-sm font-bold text-white uppercase tracking-widest">Validating Session...</span>
        </div>
      </div>
    );
  }

  if (!session?.authenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-obsidian p-6 text-center">
        <ShieldAlert size={64} className="text-ares-red mb-4 opacity-50" />
        <h1 className="text-2xl font-black text-white mb-2">Authentication Required</h1>
        <p className="text-marble/90 mb-8 max-w-md">You must be signed in with a verified ARES account to access the administrative dashboard.</p>
        <Link to="/login" className="px-6 py-3 bg-ares-red text-white font-bold ares-cut hover:bg-ares-bronze transition-colors">
          Return to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-obsidian text-white font-sans overflow-hidden font-medium selection:bg-ares-red/30">
      <DashboardSidebar session={session} permissions={permissions} notifications={notifications} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02] mix-blend-overlay" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-bl from-ares-red/5 via-transparent to-transparent pointer-events-none" />

        <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-8 overflow-hidden z-10">
          <div className="mb-4" /> {/* Spacer replaced header */}
          <DashboardRoutes 
            session={session} 
            permissions={permissions} 
            notifications={notifications} 
            stats={stats}
          />

          <div className="mt-6 flex items-center justify-between text-marble/90 text-xs font-bold uppercase tracking-widest px-4 pb-4">
             <span>ARES Robotics 23247</span>
             <span>D1 Edge Server</span>
          </div>
        </div>
      </main>
    </div>
  );
}
