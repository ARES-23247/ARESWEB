import { Link } from "@tanstack/react-router";
import { useSession } from "../utils/auth-client";
import { Activity, Target, MessageSquare, BookOpen, User, HelpCircle } from "lucide-react";
import TeamAvailability from "./TeamAvailability";
import PlatformQuickStats from "./command/PlatformQuickStats";

import { driver } from "driver.js";
import "driver.js/dist/driver.css";


export default function DashboardHome({ stats: prefetchedStats }: { stats?: unknown }) {
  const { data: session } = useSession();
  
  const role = (session?.user as Record<string, unknown> | undefined)?.role || "unverified";
  const canSeeInquiries = role !== "unverified";

  // Using prefetched stats from parent to avoid waterfall
  const stats = (prefetchedStats as Record<string, number>) || {
    posts: 0,
    events: 0,
    docs: 0,
  };
   
  const userProfile = session?.user as unknown as { nickname?: string; firstName?: string; lastName?: string };
  const firstName = userProfile?.nickname || userProfile?.firstName 
    ? (userProfile?.nickname || `${userProfile.firstName} ${userProfile.lastName || ''}`.trim())
    : ((session?.user?.name as string) || "ARES Member");

  const startTour = () => {
    const driverObj = driver({
      showProgress: true,
      steps: [
        { 
          element: '#quick-actions', 
          popover: { 
            title: 'Quick Access', 
            description: 'Jump to your profile, log outreach hours, or check the ARESLib documentation.', 
            side: "right", 
            align: 'start' 
          } 
        },
        { 
          element: '#platform-stats', 
          popover: { 
            title: 'Real-time Metrics', 
            description: 'Monitor the status of ARES content across blog posts, events, and docs.', 
            side: "top", 
            align: 'start' 
          } 
        },
        { 
          element: '#team-radar', 
          popover: { 
            title: 'Team Radar', 
            description: 'See who is currently active or available for engineering tasks.', 
            side: "left", 
            align: 'start' 
          } 
        },
      ]
    });
    driverObj.drive();
  };

  return (
    <div className="space-y-12 h-full flex flex-col bg-obsidian">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-black/40 border border-white/5 p-10 ares-cut-lg shadow-2xl backdrop-blur-sm relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-0 bg-ares-red group-hover:h-full transition-all duration-700"></div>
        <div className="relative z-10">
          <h2 className="text-3xl md:text-5xl font-black text-white flex items-center gap-6 uppercase tracking-tighter leading-none">
            <div className="p-3 bg-white/5 ares-cut-sm border border-white/10 group-hover:border-white/20 transition-all">
              <Activity className="text-ares-red" size={32} />
            </div>
            Welcome back, <span className="text-ares-red">{firstName}</span>
          </h2>
          <p className="text-marble/40 text-[10px] mt-4 uppercase tracking-[0.4em] font-black flex items-center gap-2">
            <span className="w-8 h-px bg-white/10"></span>
            Operational Command Center // System Active
          </p>
        </div>
        <button 
          onClick={startTour}
          className="mt-8 md:mt-0 flex items-center gap-3 px-6 py-3 font-black text-[10px] uppercase tracking-[0.2em] ares-cut-sm bg-white/5 border border-white/10 text-marble hover:text-white hover:bg-white/10 hover:border-white/30 transition-all relative z-10"
        >
          <HelpCircle size={16} /> INITIALIZE_GUIDE
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
        
        {/* Left Column: Quick Links & Stats */}
        <div className="lg:col-span-1 space-y-8 flex flex-col">
          
          <div className="bg-black/40 border border-white/5 p-8 ares-cut-lg shadow-xl backdrop-blur-sm relative overflow-hidden group/actions" id="quick-actions">
            <div className="absolute top-0 left-0 w-1 h-0 bg-ares-cyan group-hover/actions:h-full transition-all duration-500"></div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
              <Activity size={16} className="text-ares-cyan" />
              Strategic // Deployments
            </h3>
            <div className="grid grid-cols-2 gap-4 relative z-10">
              {[
                { to: "/dashboard/profile", icon: <User size={20} />, label: "Profile", color: "hover:text-white" },
                { to: "/dashboard/outreach", icon: <Target size={20} />, label: "Outreach", color: "hover:text-ares-red" },
                { to: "/dashboard/inquiries", icon: <MessageSquare size={20} />, label: "Inquiries", color: "hover:text-ares-gold", hide: !canSeeInquiries },
                { to: "/docs", icon: <BookOpen size={20} />, label: "ARESLib", color: "hover:text-ares-cyan" }
              ].filter(link => !link.hide).map((link, i) => (
                <Link 
                  key={i}
                  to={link.to} 
                  className="flex flex-col items-center justify-center p-6 bg-white/5 hover:bg-white/10 ares-cut-sm transition-all border border-white/5 group/link hover:scale-105 active:scale-95 shadow-lg"
                >
                  <div className={`text-marble/40 ${link.color} transition-colors mb-3 group-hover/link:scale-110 duration-300`}>
                    {link.icon}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60 group-hover/link:text-white transition-colors">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div id="platform-stats" className="flex-1">
            <PlatformQuickStats stats={stats} />
          </div>

        </div>

        {/* Right Column: Team Availability */}
        <div className="lg:col-span-2 flex flex-col h-[600px] lg:h-auto" id="team-radar">
          <TeamAvailability />
        </div>

      </div>
    </div>
  );
}


