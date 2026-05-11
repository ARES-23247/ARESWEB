import React from "react";
import ReactDOM from "react-dom/client";

import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
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
  const { data } = useSession();
  
  if (data?.user?.role !== "admin") return null;

  return (
    <>
      {ReactQueryDevtools && <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />}
      {TanStackRouterDevtools && <TanStackRouterDevtools router={router} initialIsOpen={false} position="top-right" />}
    </>
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
