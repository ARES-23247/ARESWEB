import { Suspense, lazy } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { DashboardSession, DashboardPermissions } from "../../hooks/useDashboardSession";

// ── Lazy-loaded Tab Components ───────────────────────────────────────
const BlogEditor = lazy(() => import("@/components/BlogEditor"));
const EventEditor = lazy(() => import("@/components/EventEditor"));
const ContentManager = lazy(() => import("@/components/ContentManager"));
const AssetManager = lazy(() => import("@/components/AssetManager"));
const DocsEditor = lazy(() => import("@/components/DocsEditor"));
const IntegrationsManager = lazy(() => import("@/components/IntegrationsManager"));
const ProfileEditor = lazy(() => import("@/components/ProfileEditor"));
const AdminUsers = lazy(() => import("@/components/AdminUsers"));
const DietarySummary = lazy(() => import("@/components/DietarySummary"));
const AnalyticsDashboard = lazy(() => import("@/components/AnalyticsDashboard"));
const SponsorEditor = lazy(() => import("@/components/SponsorEditor"));
const OutreachTracker = lazy(() => import("@/components/OutreachTracker"));
const AwardEditor = lazy(() => import("@/components/AwardEditor"));
const MemberImpactOverview = lazy(() => import("@/components/MemberImpactOverview"));
const BadgeManager = lazy(() => import("@/components/BadgeManager"));
const LocationsManager = lazy(() => import("@/components/LocationsManager"));
const AdminInquiries = lazy(() => import("@/components/AdminInquiries"));
const DashboardHome = lazy(() => import("@/components/DashboardHome"));
const CommandCenter = lazy(() => import("@/components/CommandCenter"));
const SponsorTokensManager = lazy(() => import("@/components/SponsorTokensManager"));

// ── Suspense Spinner ─────────────────────────────────────────────────
function TabLoader() {
  return (
    <div className="flex justify-center flex-col gap-4 items-center py-32">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      >
        <RefreshCw size={32} className="text-ares-cyan/70" />
      </motion.div>
      <p className="text-sm font-bold text-marble/60 animate-pulse uppercase tracking-widest">Loading Module...</p>
    </div>
  );
}

export default function DashboardRoutes({
  session,
  permissions,
}: {
  session: DashboardSession | null;
  permissions: DashboardPermissions;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const { isAdmin, canSeeInquiries, canSeeLogistics } = permissions;

  return (
    <div className="flex-1 w-full relative overflow-hidden flex flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="w-full h-full overflow-y-auto"
        >
          <Suspense fallback={<TabLoader />}>
            <Routes>
              <Route index element={<DashboardHome />} />
              <Route path="profile" element={<ProfileEditor />} />
              <Route path="blog/:editSlug?" element={<BlogEditor userRole={session?.user?.role} />} />
              <Route path="event/:editId?" element={<EventEditor userRole={session?.user?.role} />} />
              <Route path="docs/:editSlug?" element={<DocsEditor userRole={session?.user?.role} />} />
              <Route path="manage_blog" element={<ContentManager mode="blog" onEditPost={(slug) => navigate(`/dashboard/blog/${slug}`)} />} />
              <Route path="manage_event" element={<ContentManager mode="event" onEditEvent={(id) => navigate(`/dashboard/event/${id}`)} />} />
              <Route path="manage_docs" element={<ContentManager mode="docs" onEditDoc={(slug) => navigate(`/dashboard/docs/${slug}`)} />} />
              <Route path="assets" element={<AssetManager />} />
              <Route path="integrations" element={isAdmin ? <IntegrationsManager /> : <div className="text-center py-20">Access Denied</div>} />
              <Route path="users" element={isAdmin ? <AdminUsers /> : <div className="text-center py-20">Access Denied</div>} />
              <Route
                path="inquiries"
                element={canSeeInquiries ? <AdminInquiries /> : <div className="text-center py-20">Access Denied</div>}
              />
              <Route path="impact_roster" element={isAdmin ? <MemberImpactOverview /> : <div className="text-center py-20">Access Denied</div>} />
              <Route
                path="badges"
                element={isAdmin ? <BadgeManager /> : <div className="text-center py-20">Access Denied</div>}
              />
              <Route
                path="logistics"
                element={canSeeLogistics ? <DietarySummary /> : <div className="text-center py-20">Access Denied</div>}
              />
              <Route
                path="analytics"
                element={<AnalyticsDashboard />}
              />
              <Route
                path="sponsors"
                element={<SponsorEditor />}
              />
              <Route
                path="sponsor_tokens"
                element={isAdmin ? <SponsorTokensManager /> : <div className="text-center py-20">Access Denied</div>}
              />
              <Route
                path="outreach"
                element={<OutreachTracker />}
              />
              <Route
                path="legacy"
                element={<AwardEditor />}
              />
              <Route
                path="locations"
                element={<LocationsManager />}
              />
              <Route path="command_center" element={isAdmin ? <CommandCenter /> : <div className="text-center py-20">Access Denied</div>} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
