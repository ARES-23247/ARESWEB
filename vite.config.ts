import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "favicon.webp", "robots.txt"],
      manifest: {
        id: "/",
        name: "ARES 23247 Team Portal",
        short_name: "ARES Portal",
        description:
          "Team portal for ARES 23247, a FIRST® Tech Challenge robotics team in Morgantown, West Virginia.",
        theme_color: "#1A1A1A",
        background_color: "#1A1A1A",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/favicon.webp",
            sizes: "1024x1024",
            type: "image/webp",
            purpose: "any",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        navigateFallback: "/index.html",
        // Only true SPA-only areas may fall back to index.html. Public record
        // routes must reach Hosting/the renderer so missing records preserve
        // their real 404 status even for clients with a service worker.
        navigateFallbackAllowlist: [
          /^\/dashboard(?:\/|$)/,
          /^\/tournaments(?:\/|$)/,
          /^\/academy\/playground\/?$/,
          /^\/tasks\/?$/,
        ],
        globPatterns: [
          "index.html",
          "manifest.webmanifest",
          "favicon.{svg,webp}",
          "assets/index-*.{js,css}",
          "assets/index.esm-*.js",
          "assets/rolldown-runtime-*.js",
          "assets/firebaseCore-*.js",
          "assets/vendor-{framer,radix,lucide}-*.js",
        ],
        // API and Firebase traffic must always reach the network. Only the
        // versioned application shell is precached.
        runtimeCaching: [],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (normalizedId.includes("node_modules")) {
            if (
              normalizedId.includes("react-markdown") ||
              normalizedId.includes("remark") ||
              normalizedId.includes("rehype")
            ) {
              return "vendor-markdown";
            }
            if (normalizedId.includes("jszip")) {
              return "vendor-jszip";
            }
            if (normalizedId.includes("dompurify")) {
              return "vendor-dompurify";
            }
            if (
              normalizedId.includes("@xyflow") ||
              normalizedId.includes("reactflow")
            ) {
              return "vendor-xyflow";
            }
            if (normalizedId.includes("@babel")) {
              return "vendor-babel";
            }
            if (normalizedId.includes("three")) {
              return "vendor-three";
            }
            if (normalizedId.includes("lucide-react")) {
              return "vendor-lucide";
            }
            if (normalizedId.includes("framer-motion")) {
              return "vendor-framer";
            }
            if (normalizedId.includes("@radix-ui")) {
              return "vendor-radix";
            }
            if (normalizedId.includes("prettier")) {
              return "vendor-prettier";
            }
            if (
              normalizedId.includes("recharts") ||
              normalizedId.includes("d3")
            ) {
              return "vendor-recharts";
            }
            return undefined;
          }
        },
      },
    },
  },
  test: {
    globals: true,
    mockReset: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    server: {
      deps: {
        inline: [/@tanstack\/react-query/],
      },
    },
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "functions/**",
      "e2e/**",
      "tests/rules/**",
    ],
    coverage: {
      // Explicitly instrument the current security, privacy, public-data, and
      // administrative reliability surface. A listed module therefore reports
      // 0% instead of disappearing when its importing test is removed.
      include: [
        "src/lib/api.ts",
        "src/lib/contentUrls.ts",
        "src/lib/diff.ts",
        "src/lib/dateOnly.ts",
        "src/lib/outreachExport.ts",
        "src/lib/security.ts",
        "src/lib/simulationDrafts.ts",
        "src/lib/storeCatalogData.ts",
        "src/lib/tournamentApi.ts",
        "src/lib/tournamentStats.ts",
        "src/components/PublicDataState.tsx",
        "src/components/BlogThumbnailImage.tsx",
        "src/components/PwaUpdatePrompt.tsx",
        "src/components/SEO.tsx",
        "src/app/dashboard/photos/*.{ts,tsx}",
        "src/app/dashboard/profile/page.tsx",
        "src/app/dashboard/tasks/taskRecord.ts",
        "src/app/dashboard/tasks/taskSubtasks.ts",
        "src/app/tournaments/[id]/TournamentMatchEditForm.tsx",
        "src/app/tournaments/[id]/TournamentMatchPrintDialog.tsx",
        "src/app/dashboard/profile/components/*.tsx",
        "src/app/dashboard/inquiries/page.tsx",
        "src/app/dashboard/outreach/page.tsx",
        "src/app/dashboard/sponsors/page.tsx",
        "src/app/dashboard/users/page.tsx",
        "src/app/dashboard/users/components/UserInviteForm.tsx",
        "src/app/dashboard/users/components/UserRosterTable.tsx",
        "src/app/dashboard/users/components/UserEmailRosterPanel.tsx",
        "src/app/dashboard/users/emailRoster.ts",
        "src/app/finance/page.tsx",
        "src/app/gallery/page.tsx",
        "src/app/leaderboard/page.tsx",
        "src/app/outreach/page.tsx",
        "src/app/sponsors/page.tsx",
        "src/app/robots/api.ts",
        "src/app/robots/RobotEditorModal.tsx",
      ],
      thresholds: {
        // Ratchet the measured legacy baseline while enforcing the project
        // standard on security-sensitive utilities and newly covered code.
        lines: 56,
        functions: 42,
        "src/lib/security.ts": {
          lines: 85,
          functions: 100,
        },
        "src/lib/api.ts": {
          lines: 85,
          functions: 100,
        },
        "src/lib/contentUrls.ts": {
          lines: 85,
          functions: 100,
        },
        "src/components/BlogThumbnailImage.tsx": {
          lines: 85,
          functions: 100,
        },
        "src/lib/diff.ts": {
          lines: 85,
          functions: 100,
        },
        "src/lib/dateOnly.ts": {
          lines: 85,
          functions: 100,
        },
        "src/lib/outreachExport.ts": {
          lines: 85,
          functions: 100,
        },
        "src/lib/tournamentApi.ts": {
          lines: 85,
          functions: 100,
        },
        "src/lib/tournamentStats.ts": {
          lines: 85,
          functions: 100,
        },
        "src/app/tournaments/[id]/TournamentMatchEditForm.tsx": {
          lines: 85,
          functions: 100,
        },
        "src/lib/simulationDrafts.ts": {
          lines: 85,
          functions: 100,
        },
        "src/app/robots/api.ts": {
          lines: 85,
          functions: 100,
        },
        "src/app/dashboard/users/components/UserInviteForm.tsx": {
          lines: 85,
          functions: 100,
        },
        "src/app/dashboard/users/emailRoster.ts": {
          lines: 85,
          functions: 100,
        },
        "src/app/dashboard/users/components/UserEmailRosterPanel.tsx": {
          lines: 85,
          functions: 100,
        },
        "src/app/dashboard/tasks/taskRecord.ts": {
          lines: 85,
          functions: 100,
        },
        "src/app/dashboard/tasks/taskSubtasks.ts": {
          lines: 85,
          functions: 100,
        },
      },
    },
  },
});
