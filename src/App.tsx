import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Outlet, Link, NavLink } from "react-router-dom";
import { Cpu, Grid, Compass } from "lucide-react";
import { AuthProvider } from "@/context/AuthContext";
import LayoutWrapper from "@/components/layout/LayoutWrapper";
import ErrorBoundary from "@/components/ErrorBoundary";
import TechStackPage from "@/app/tech-stack/page";

// Lazy-load public pages for optimal bundle splitting
const Home = lazy(() => import("@/app/page"));
const AboutPage = lazy(() => import("@/app/about/page"));
const AcademyPage = lazy(() => import("@/app/academy/page"));
const AccessibilityPage = lazy(() => import("@/app/accessibility/page"));
const BlogFeedPage = lazy(() => import("@/app/blog/page"));
const BlogPostPage = lazy(() => import("@/app/blog/[slug]/page"));
const CalendarPage = lazy(() => import("@/app/calendar/page"));
const DeveloperApiPage = lazy(() => import("@/app/developer-api/page"));
const EventDetailPage = lazy(() => import("@/app/events/[id]/page"));
const FinanceLedgerPage = lazy(() => import("@/app/finance/page"));
const GalleryPage = lazy(() => import("@/app/gallery/page"));
const VideosPage = lazy(() => import("@/app/videos/page"));
const JoinPage = lazy(() => import("@/app/join/page"));
const LeaderboardPage = lazy(() => import("@/app/leaderboard/page"));
const LocationMorgantownPage = lazy(() => import("@/app/location-morgantown/page"));
const OutreachPage = lazy(() => import("@/app/outreach/page"));
const PrivacyPage = lazy(() => import("@/app/privacy/page"));
const RobotsFeedPage = lazy(() => import("@/app/robots/page"));
const RobotDetailPage = lazy(() => import("@/app/robots/[id]/page"));
const SeasonsPage = lazy(() => import("@/app/seasons/page"));
const SponsorsPage = lazy(() => import("@/app/sponsors/page"));
const StorePage = lazy(() => import("@/app/store/page"));
const TasksRedirect = lazy(() => import("@/app/tasks/page"));
const TermsPage = lazy(() => import("@/app/terms/page"));

// Lazy-load dashboard pages
const DashboardLayout = lazy(() => import("@/app/dashboard/layout"));
const DashboardPage = lazy(() => import("@/app/dashboard/page"));
const DashboardProfilePage = lazy(() => import("@/app/dashboard/profile/page"));
const DashboardBlogPage = lazy(() => import("@/app/dashboard/blog/page"));
const DashboardDocumentsPage = lazy(() => import("@/app/dashboard/documents/page"));
const DashboardAcademyPage = lazy(() => import("@/app/dashboard/academy/page"));
const DashboardAreslibPage = lazy(() => import("@/app/dashboard/areslib/page"));
const DashboardSimulationsPage = lazy(() => import("@/app/dashboard/simulations/page"));
const DashboardEventsPage = lazy(() => import("@/app/dashboard/events/page"));
const DashboardPhotosPage = lazy(() => import("@/app/dashboard/photos/page"));
const DashboardTasksPage = lazy(() => import("@/app/dashboard/tasks/page"));
const DashboardVideosPage = lazy(() => import("@/app/dashboard/videos/page"));
const DashboardInquiriesPage = lazy(() => import("@/app/dashboard/inquiries/page"));
const DashboardUsersPage = lazy(() => import("@/app/dashboard/users/page"));
const DashboardSponsorsPage = lazy(() => import("@/app/dashboard/sponsors/page"));
const DashboardOutreachPage = lazy(() => import("@/app/dashboard/outreach/page"));

// Premium fallback loader with ARES branding
function AppLoading() {
  return (
    <div className="flex flex-col justify-center items-center min-h-[60vh] bg-obsidian text-marble">
      <div className="w-10 h-10 border-4 border-ares-red/35 border-t-ares-red rounded-full animate-spin mb-4" />
      <p className="text-[10px] font-black uppercase tracking-widest text-ares-gold/85 animate-pulse font-heading">
        Synchronizing Systems...
      </p>
    </div>
  );
}

export default function App() {
  React.useEffect(() => {
    // In production, do not load reCAPTCHA if NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not configured.
    // In development/test environments, we can fall back to the public testing key.
    const siteKey = import.meta.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || 
      (import.meta.env.DEV ? "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI" : "");

    if (!siteKey) {
      console.warn("[reCAPTCHA] Site key is not configured. Security checks will be bypassed.");
      return;
    }

    // Only load reCAPTCHA once
    if (document.getElementById("recaptcha-script")) return;
    
    const script = document.createElement("script");
    script.id = "recaptcha-script";
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <LayoutWrapper>
          <ErrorBoundary>
            <Suspense fallback={<AppLoading />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/academy" element={<AcademyPage />} />
                <Route path="/academy/:slug" element={<AcademyPage />} />
                <Route path="/docs" element={<AcademyPage />} />
                <Route path="/docs/:slug" element={<AcademyPage />} />
                <Route path="/accessibility" element={<AccessibilityPage />} />
                <Route path="/blog" element={<BlogFeedPage />} />
                <Route path="/blog/:slug" element={<BlogPostPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/developer-api" element={<DeveloperApiPage />} />
                <Route path="/events/:id" element={<EventDetailPage />} />
                <Route path="/finance" element={<FinanceLedgerPage />} />
                <Route path="/gallery" element={<GalleryPage />} />
                <Route path="/videos" element={<VideosPage />} />
                <Route path="/join" element={<JoinPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/location-morgantown" element={<LocationMorgantownPage />} />
                <Route path="/outreach" element={<OutreachPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/robots" element={<RobotsFeedPage />} />
                <Route path="/robots/:id" element={<RobotDetailPage />} />
                <Route path="/seasons" element={<SeasonsPage />} />
                <Route path="/sponsors" element={<SponsorsPage />} />
                <Route path="/store" element={<StorePage />} />
                <Route path="/tasks" element={<TasksRedirect />} />
                <Route path="/tech-stack" element={<TechStackPage />} />
                <Route path="/terms" element={<TermsPage />} />
                
                {/* Dashboard routes nested under DashboardLayout */}
                <Route path="/dashboard" element={<DashboardLayout><Outlet /></DashboardLayout>}>
                  <Route index element={<DashboardPage />} />
                  <Route path="profile" element={<DashboardProfilePage />} />
                  <Route path="tasks" element={<DashboardTasksPage />} />
                  <Route path="blog" element={<DashboardBlogPage />} />
                  <Route path="events" element={<DashboardEventsPage />} />
                  <Route path="documents" element={<DashboardDocumentsPage />} />
                  <Route path="academy" element={<DashboardAcademyPage />} />
                  <Route path="areslib" element={<DashboardAreslibPage />} />
                  <Route path="simulations" element={<DashboardSimulationsPage />} />
                  <Route path="videos" element={<DashboardVideosPage />} />
                  <Route path="photos" element={<DashboardPhotosPage />} />
                  <Route path="inquiries" element={<DashboardInquiriesPage />} />
                  <Route path="users" element={<DashboardUsersPage />} />
                  <Route path="sponsors" element={<DashboardSponsorsPage />} />
                  <Route path="outreach" element={<DashboardOutreachPage />} />
                </Route>
                
                {/* 404 Route */}
                <Route path="*" element={
                  <div className="flex flex-col justify-center items-center min-h-[70vh] bg-obsidian text-marble p-6">
                    <h1 className="text-5xl font-black uppercase text-white tracking-widest font-heading mb-4">404</h1>
                    <p className="text-marble/60 text-sm mb-8">Page not found.</p>
                    <Link to="/" className="clipped-button bg-ares-red text-white uppercase text-xs">Go Home</Link>
                  </div>
                } />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </LayoutWrapper>
      </AuthProvider>
    </BrowserRouter>
  );
}
