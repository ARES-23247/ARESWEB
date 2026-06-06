import React from "react";
import { BrowserRouter, Routes, Route, Outlet, Link } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import LayoutWrapper from "@/components/layout/LayoutWrapper";

// Import all pages using the @ alias
import Home from "@/app/page";
import AboutPage from "@/app/about/page";
import AresPlannerPage from "@/app/aresplanner/page";
import BlogFeedPage from "@/app/blog/page";
import BlogPostPage from "@/app/blog/[slug]/page";
import CalendarPage from "@/app/calendar/page";
import EventDetailPage from "@/app/events/[id]/page";
import GalleryPage from "@/app/gallery/page";
import JoinPage from "@/app/join/page";
import JudgesPage from "@/app/judges/page";
import LeaderboardPage from "@/app/leaderboard/page";
import OutreachPage from "@/app/outreach/page";
import RobotsFeedPage from "@/app/robots/page";
import RobotDetailPage from "@/app/robots/[id]/page";
import SimulatorsPage from "@/app/simulators/page";
import SponsorsPage from "@/app/sponsors/page";
import StorePage from "@/app/store/page";
import TasksRedirect from "@/app/tasks/page";
import TechStackPage from "@/app/tech-stack/page";

// Dashboard
import DashboardLayout from "@/app/dashboard/layout";
import DashboardPage from "@/app/dashboard/page";
import DashboardBlogPage from "@/app/dashboard/blog/page";
import DashboardDocumentsPage from "@/app/dashboard/documents/page";
import DashboardEventsPage from "@/app/dashboard/events/page";
import DashboardPhotosPage from "@/app/dashboard/photos/page";
import DashboardScopePage from "@/app/dashboard/scope/page";
import DashboardTasksPage from "@/app/dashboard/tasks/page";
import DashboardVideosPage from "@/app/dashboard/videos/page";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LayoutWrapper>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/aresplanner" element={<AresPlannerPage />} />
            <Route path="/blog" element={<BlogFeedPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/join" element={<JoinPage />} />
            <Route path="/judges" element={<JudgesPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/outreach" element={<OutreachPage />} />
            <Route path="/robots" element={<RobotsFeedPage />} />
            <Route path="/robots/:id" element={<RobotDetailPage />} />
            <Route path="/simulators" element={<SimulatorsPage />} />
            <Route path="/sponsors" element={<SponsorsPage />} />
            <Route path="/store" element={<StorePage />} />
            <Route path="/tasks" element={<TasksRedirect />} />
            <Route path="/tech-stack" element={<TechStackPage />} />
            
            {/* Dashboard routes nested under DashboardLayout */}
            <Route path="/dashboard" element={<DashboardLayout><Outlet /></DashboardLayout>}>
              <Route index element={<DashboardPage />} />
              <Route path="tasks" element={<DashboardTasksPage />} />
              <Route path="scope" element={<DashboardScopePage />} />
              <Route path="blog" element={<DashboardBlogPage />} />
              <Route path="events" element={<DashboardEventsPage />} />
              <Route path="documents" element={<DashboardDocumentsPage />} />
              <Route path="videos" element={<DashboardVideosPage />} />
              <Route path="photos" element={<DashboardPhotosPage />} />
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
        </LayoutWrapper>
      </AuthProvider>
    </BrowserRouter>
  );
}
