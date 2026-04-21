import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";
import CommandPalette from "./components/CommandPalette";

import ScrollToTop from "./components/ScrollToTop";

import Home from "./pages/Home";
import About from "./pages/About";
import Seasons from "./pages/Seasons";
import Outreach from "./pages/Outreach";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Gallery from "./pages/Gallery";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import Dashboard from "./pages/Dashboard";
import TechStack from "./pages/TechStack";
import Accessibility from "./pages/Accessibility";
import Privacy from "./pages/Privacy";
import Docs from "./pages/Docs";
import Login from "./pages/Login";
import ProfilePage from "./pages/ProfilePage";
import BugReport from "./pages/BugReport";
import Sponsors from "./pages/Sponsors";
import SponsorROI from "./pages/SponsorROI";
import JudgesHub from "./pages/JudgesHub";
import PrintPortfolio from "./pages/PrintPortfolio";
import Join from "./pages/Join";
import Leaderboard from "./pages/Leaderboard";
import NotFound from "./pages/NotFound";

export default function App() {
  const location = useLocation();
  
  return (
    <ErrorBoundary>
      <ScrollToTop />
      <CommandPalette />
      <Navbar />
      <main id="main-content" role="main" className="flex-1 flex flex-col pt-16">
        <AnimatePresence mode="wait">
          <ErrorBoundary>
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
              <Route path="/dashboard" element={<Dashboard />} />
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </AnimatePresence>
      </main>
      <Footer />
    </ErrorBoundary>
  );
}
