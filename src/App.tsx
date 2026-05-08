import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";
import React, { Suspense } from "react";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";
import CommandPalette from "./components/CommandPalette";
import MobileQuickActions from "./components/MobileQuickActions";
import ScrollToTop from "./components/ScrollToTop";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

import { useModal } from "./contexts/ModalContext";
import { useRegisterSW } from "virtual:pwa-register/react";
import { initWebVitals } from "./utils/webVitals";
import routes from "./routes";

const GlobalRAGChatbot = React.lazy(() => import("./components/ai/GlobalRAGChatbot").then(m => ({ default: m.GlobalRAGChatbot })));

export default function App() {
  const location = useLocation();
  const modal = useModal();

  React.useEffect(() => {
    initWebVitals();
  }, []);

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
      <PWAInstallPrompt />
      <CommandPalette />
      <MobileQuickActions />
      <Suspense fallback={null}><GlobalRAGChatbot /></Suspense>
      <Navbar />
      <main id="main-content" role="main" className="flex-1 flex flex-col pt-16">
        <AnimatePresence mode="wait">
          <ErrorBoundary>
            <Suspense fallback={<div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-ares-gold border-t-transparent" /></div>}>
              <Routes location={location} key={location.pathname}>
                {routes.map(({ path, component: Component }) => (
                  <Route key={path} path={path} element={<Component />} />
                ))}
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AnimatePresence>
      </main>
      <Footer />
    </ErrorBoundary>
  );
}
