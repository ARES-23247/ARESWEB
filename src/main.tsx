import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { HelmetProvider } from "react-helmet-async";
import { ModalProvider } from "./contexts/ModalContext";
import App from "./App";
import "./index.css";
import "./i18n";
import { LiveblocksProvider } from "@liveblocks/react";

// SEC-REDIRECT: Cloudflare Pages CDN serves static assets before Functions middleware runs.
// This client-side redirect catches the SPA case where HTML loads on *.pages.dev
// but API calls would fail (since _middleware.ts blocks /api/* on .pages.dev).
if (
  typeof window !== "undefined" &&
  window.location.hostname.endsWith(".pages.dev")
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
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

import { NuqsAdapter } from "nuqs/adapters/react-router/v7";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NuqsAdapter>
            <LiveblocksProvider authEndpoint="/api/liveblocks/auth">
              <ModalProvider>
                <App />
              </ModalProvider>
            </LiveblocksProvider>
          </NuqsAdapter>
        </BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);
