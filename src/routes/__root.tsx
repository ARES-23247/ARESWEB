import { createRootRoute, Outlet, useLocation } from '@tanstack/react-router';
import { AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";
import React, { Suspense } from "react";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ErrorBoundary from "../components/ErrorBoundary";
import CommandPalette from "../components/CommandPalette";
import MobileQuickActions from "../components/MobileQuickActions";
import ScrollToTop from "../components/ScrollToTop";
import PWAInstallPrompt from "../components/PWAInstallPrompt";
import SkipLink from "../components/SkipLink";

import { useModal } from "../contexts/ModalContext";
import { useRegisterSW } from "virtual:pwa-register/react";
import { initWebVitals } from "../utils/webVitals";

const GlobalRAGChatbot = React.lazy(() => import("../components/ai/GlobalRAGChatbot").then(m => ({ default: m.GlobalRAGChatbot })));

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
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
      <SkipLink />
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
              <Outlet key={location.pathname} />
            </Suspense>
          </ErrorBoundary>
        </AnimatePresence>
      </main>
      <Footer />
    </ErrorBoundary>
  );
}
