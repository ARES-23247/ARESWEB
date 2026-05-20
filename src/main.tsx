import React from "react";
import ReactDOM from "react-dom/client";

import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";
const ReactQueryDevtools = import.meta.env.DEV
  ? React.lazy(() => import("@tanstack/react-query-devtools").then(m => ({ default: m.ReactQueryDevtools })))
  : null;
const TanStackRouterDevtoolsPanel = import.meta.env.DEV
  ? React.lazy(() => import("@tanstack/router-devtools").then(m => ({ default: m.TanStackRouterDevtoolsPanel })))
  : null;
import { HelmetProvider } from "react-helmet-async";
import { ModalProvider } from "./contexts/ModalContext";
import "./index.css";
import "./i18n";

// SEC-REDIRECT: Cloudflare Pages CDN serves static assets before Functions middleware runs.
// This client-side redirect catches the SPA case where HTML loads on *.pages.dev
// but API calls would fail (since _middleware.ts blocks /api/* on .pages.dev).
// CI builds set VITE_DISABLE_PAGES_REDIRECT=true so E2E tests can run against the preview.
if (
  typeof window !== "undefined" &&
  window.location.hostname.endsWith(".pages.dev") &&
  !import.meta.env.VITE_DISABLE_PAGES_REDIRECT
) {
  const target = new URL(window.location.href);
  target.hostname = "aresfirst.org";
  target.protocol = "https:";
  window.location.replace(target.toString());
  // Halt further execution — prevent React from rendering a broken state
  throw new Error("Redirecting to aresfirst.org");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // EFF-D01: Cache D1 reads for 1 min to reduce costs
      gcTime: 1000 * 60 * 60 * 24 * 7, // Keep offline data for 7 days
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Track query errors in Sentry
      if (import.meta.env.VITE_SENTRY_DSN) {
        Sentry.captureException(error, {
          tags: { type: 'query' },
          extra: { queryKey: query.queryKey },
        });
      }
      console.error('[Query Error]', error.message, { queryKey: query.queryKey });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Track mutation errors in Sentry
      if (import.meta.env.VITE_SENTRY_DSN) {
        Sentry.captureException(error, {
          tags: { type: 'mutation', mutationId: mutation.mutationId },
        });
      }
      console.error('[Mutation Error]', error.message, { mutationId: mutation.mutationId });
    },
  }),
});

const persister = createAsyncStoragePersister({
  storage: {
    getItem: async (key) => {
      const val = await get(key);
      return val === undefined ? null : val;
    },
    setItem: set,
    removeItem: del,
  },
});

import * as Sentry from "@sentry/react";
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { useSession } from "./utils/auth-client";

// Import the generated route tree
import { routeTree } from './routeTree.gen';

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}





function DevTools() {
  if (!import.meta.env.DEV) return null;
  const { data } = useSession();
  const [isRouterDevToolsOpen, setIsRouterDevToolsOpen] = React.useState(false);
  
  if ((data?.user as unknown as { role?: string })?.role !== "admin") return null;

  return (
    <React.Suspense fallback={null}>
      {ReactQueryDevtools && <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />}
      
      {/* Toggle Button */}
      <div 
        className="fixed bottom-4 right-[100px] z-[9999]"
      >
        <button
          onClick={() => setIsRouterDevToolsOpen(!isRouterDevToolsOpen)}
          className="flex items-center justify-center w-10 h-10 bg-[#0f172a] border border-[#334155] rounded-lg shadow-xl cursor-pointer hover:bg-[#1e293b] transition-colors"
          title="Toggle TanStack Router DevTools"
        >
          <div className="flex flex-col items-center leading-none">
            <span className="text-[10px] font-bold text-[#00e599]">TAN</span>
            <span className="text-[10px] font-bold text-[#00e599]">STACK</span>
          </div>
        </button>
      </div>

      {/* The Panel */}
      {isRouterDevToolsOpen && TanStackRouterDevtoolsPanel && (
        <div className="fixed bottom-0 left-0 right-0 h-[400px] z-[9998] shadow-2xl">
          <TanStackRouterDevtoolsPanel 
            router={router} 
            isOpen={isRouterDevToolsOpen}
            setIsOpen={setIsRouterDevToolsOpen}
          />
        </div>
      )}
    </React.Suspense>
  );
}

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    tracePropagationTargets: ["localhost", /^https:\/\/aresfirst\.org/],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
        <ModalProvider>
          <RouterProvider router={router} />
        </ModalProvider>
        <DevTools />
      </PersistQueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);
