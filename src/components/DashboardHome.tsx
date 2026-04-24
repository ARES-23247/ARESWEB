import { Link } from "react-router-dom";
import { useSession } from "../utils/auth-client";
import { Activity, Target, MessageSquare, BookOpen, User, HelpCircle } from "lucide-react";
import TeamAvailability from "./TeamAvailability";
import PlatformQuickStats from "./command/PlatformQuickStats";
import { api } from "../api/client";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export default function DashboardHome() {
  const { data: session } = useSession();
  
  // @ts-expect-error - BetterAuth session typing
  const role = session?.user?.role || "unverified";
  const canSeeInquiries = role !== "unverified";

  const { data: statsRes } = api.analytics.getStats.useQuery(["admin-stats"], {}, { enabled: canSeeInquiries });

  const stats = {
    posts: statsRes?.status === 200 ? statsRes.body.posts : 0,
    events: statsRes?.status === 200 ? statsRes.body.events : 0,
    docs: statsRes?.status === 200 ? statsRes.body.docs : 0,
  };
   
  // @ts-expect-error - BetterAuth session typing
  const firstName = session?.user?.first_name || session?.user?.name || "ARES Member";

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
    <div className="space-y-8 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-black text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-ares-red/20 to-red-900/20 ares-cut-sm border border-ares-red/20">
              <Activity className="text-ares-red" size={28} />
            </div>
            Welcome back, {firstName}
          </h2>
          <p className="text-marble/40 text-sm mt-2">
            Your centralized ARESWEB overview and quick actions.
          </p>
        </div>
        <button 
          onClick={startTour}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 ares-cut-sm text-xs font-bold uppercase tracking-widest text-marble hover:bg-white/10 transition-all"
        >
          <HelpCircle size={16} /> Take a Tour
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        
        {/* Left Column: Quick Links & Stats */}
        <div className="lg:col-span-1 space-y-6 flex flex-col">
          
          <div className="p-2" id="quick-actions">
            <h3 className="font-black text-white text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity size={16} className="text-ares-cyan" />
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/dashboard/profile" className="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 ares-cut-sm transition-colors border border-white/5 group">
                <User size={20} className="text-marble/40 group-hover:text-white mb-2" />
                <span className="text-xs font-bold uppercase tracking-wider text-marble">My Profile</span>
              </Link>
              <Link to="/dashboard/outreach" className="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 ares-cut-sm transition-colors border border-white/5 group">
                <Target size={20} className="text-marble/40 group-hover:text-white mb-2" />
                <span className="text-xs font-bold uppercase tracking-wider text-marble">Outreach</span>
              </Link>
              {canSeeInquiries && (
                <Link to="/dashboard/inquiries" className="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 ares-cut-sm transition-colors border border-white/5 group">
                  <MessageSquare size={20} className="text-marble/40 group-hover:text-white mb-2" />
                  <span className="text-xs font-bold uppercase tracking-wider text-marble">Inquiries</span>
                </Link>
              )}
              <Link to="/docs" className="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 ares-cut-sm transition-colors border border-white/5 group">
                <BookOpen size={20} className="text-marble/40 group-hover:text-white mb-2" />
                <span className="text-xs font-bold uppercase tracking-wider text-marble">ARESLib</span>
              </Link>
            </div>
          </div>

          <div id="platform-stats">
            <PlatformQuickStats stats={stats} />
          </div>

        </div>

        {/* Right Column: Team Availability */}
        <div className="lg:col-span-2 p-2 flex flex-col h-[500px] lg:h-auto" id="team-radar">
          <TeamAvailability />
        </div>

      </div>
    </div>
  );
}
