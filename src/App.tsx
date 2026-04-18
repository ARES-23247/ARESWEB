import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";

import Home from "./pages/Home";
import About from "./pages/About";
import Seasons from "./pages/Seasons";
import Outreach from "./pages/Outreach";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Contact from "./pages/Contact";
import Gallery from "./pages/Gallery";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import Dashboard from "./pages/Dashboard";
import TechStack from "./pages/TechStack";
import Accessibility from "./pages/Accessibility";
import Privacy from "./pages/Privacy";

export default function App() {
  const location = useLocation();
  
  return (
    <ErrorBoundary>
      <Navbar />
      <main className="flex-1 flex flex-col pt-16">
        <AnimatePresence mode="wait">
          <ErrorBoundary>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/seasons" element={<Seasons />} />
              <Route path="/outreach" element={<Outreach />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/:id" element={<EventDetail />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/tech-stack" element={<TechStack />} />
              <Route path="/accessibility" element={<Accessibility />} />
              <Route path="/privacy" element={<Privacy />} />
            </Routes>
          </ErrorBoundary>
        </AnimatePresence>
      </main>
      <Footer />
    </ErrorBoundary>
  );
}
