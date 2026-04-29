import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";
import CommandPalette from "./components/CommandPalette";
import MobileQuickActions from "./components/MobileQuickActions";

import ScrollToTop from "./components/ScrollToTop";

import React, { Suspense } from "react";

const Home = React.lazy(() => import("./pages/Home"));
const About = React.lazy(() => import("./pages/About"));
const Seasons = React.lazy(() => import("./pages/Seasons"));
const Outreach = React.lazy(() => import("./pages/Outreach"));
const Blog = React.lazy(() => import("./pages/Blog"));
const BlogPost = React.lazy(() => import("./pages/BlogPost"));
const Gallery = React.lazy(() => import("./pages/Gallery"));
const Events = React.lazy(() => import("./pages/Events"));
const EventDetail = React.lazy(() => import("./pages/EventDetail"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const TechStack = React.lazy(() => import("./pages/TechStack"));
const Accessibility = React.lazy(() => import("./pages/Accessibility"));
const Privacy = React.lazy(() => import("./pages/Privacy"));
const Docs = React.lazy(() => import("./pages/Docs"));
const Login = React.lazy(() => import("./pages/Login"));
const ProfilePage = React.lazy(() => import("./pages/ProfilePage"));
const BugReport = React.lazy(() => import("./pages/BugReport"));
const Sponsors = React.lazy(() => import("./pages/Sponsors"));
const SponsorROI = React.lazy(() => import("./pages/SponsorROI"));
const JudgesHub = React.lazy(() => import("./pages/JudgesHub"));
const PrintPortfolio = React.lazy(() => import("./pages/PrintPortfolio"));
const Join = React.lazy(() => import("./pages/Join"));
const Leaderboard = React.lazy(() => import("./pages/Leaderboard"));
const Store = React.lazy(() => import("./pages/Store"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

import { useModal } from "./contexts/ModalContext";
import { useRegisterSW } from "virtual:pwa-register/react";

export default function App() {
  const location = useLocation();
  const modal = useModal();

  useRegisterSW({
    onNeedRefresh() {
      modal.confirm({
        title: "Update Available",
        description: "New content is available. Would you like to reload the app?",
        confirmText: "Reload",
      }).then(confirmed => {
        if (confirmed) {
          window.location.reload();
        }
      });
    },
  });
  
  return (
    <ErrorBoundary>
      <Toaster theme="dark" position="bottom-right" />
      <ScrollToTop />
      <CommandPalette />
      <MobileQuickActions />
      <Navbar />
      <main id="main-content" role="main" className="flex-1 flex flex-col pt-16">
        <AnimatePresence mode="wait">
          <ErrorBoundary>
            <Suspense fallback={<div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-ares-gold border-t-transparent" /></div>}>
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/seasons" element={<Seasons />} />
                <Route path="/outreach" element={<Outreach />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/events" element={<Events />} />
                <Route path="/events/:id" element={<EventDetail />} />
                <Route path="/dashboard/*" element={<Dashboard />} />
                <Route path="/login" element={<Login />} />
                <Route path="/profile/:userId" element={<ProfilePage />} />
                <Route path="/tech-stack" element={<TechStack />} />
                <Route path="/accessibility" element={<Accessibility />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/docs" element={<Docs />} />
                <Route path="/docs/:slug" element={<Docs />} />
                <Route path="/bug-report" element={<BugReport />} />
                <Route path="/sponsors" element={<Sponsors />} />
                <Route path="/sponsors/roi/:tokenId" element={<SponsorROI />} />
                <Route path="/join" element={<Join />} />
                <Route path="/judges" element={<JudgesHub />} />
                <Route path="/judges/print" element={<PrintPortfolio />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/store" element={<Store />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AnimatePresence>
      </main>
      <Footer />
    </ErrorBoundary>
  );
}
