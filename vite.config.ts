import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";
import { imagetools } from "vite-imagetools";
import type { Plugin } from "vite";
import path from "path";
import history from "connect-history-api-fallback";
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

// SPA fallback plugin for vite preview
function spaFallbackPlugin(): Plugin {
  return {
    name: 'spa-fallback',
    configurePreviewServer(server) {
      return () => {
        server.middlewares.use(

          history({
            // Disable index.html rewrite for API routes
            rewrites: [
              {
                from: /^\/api\/.*$/,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                to: (context: any) => context.parsedUrl.pathname
              }
            ]
          }) as any // eslint-disable-line @typescript-eslint/no-explicit-any -- connect-history-api-fallback type issue
        );
      };
    },
  };
}

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
    exclude: ['**/node_modules/**', 'tests/e2e/**', '.claude/**'],
    coverage: {
      provider: "v8",
      include: ['src/utils/**', 'src/hooks/**', 'functions/api/routes/**'],
      exclude: [
        'functions/api/routes/sitemap.ts',
        '**/*.test.ts'
      ],
      thresholds: {
        lines: 85,
        functions: 100,
        branches: 80,
        statements: 85
      }
    },
    server: {
      deps: {
        external: [/parse5/]
      }
    }
  },
  plugins: [
    TanStackRouterVite(),
    spaFallbackPlugin(),
    react(),
    imagetools({
      include: ['**/*.{png,jpg,jpeg}'],
      defaultDirectives: new URLSearchParams({
        format: 'webp',
        quality: '85',
      }),
    }),
    visualizer({ emitFile: true, filename: "stats.html" }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'ares_hero.png'],
      manifest: {
        name: 'ARES 23247 Web Portal',
        short_name: 'ARES',
        description: 'FIRST Tech Challenge Team 23247 - Appalachian Robotics & Engineering Society.',
        theme_color: '#C00000',
        background_color: '#09090b',
        display: 'standalone',
        icons: [
          {
            src: '/ares_hero.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/ares_hero.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 15000000,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        navigateFallback: null,
        navigateFallbackDenylist: [/^\/api\//, /\/[^/]+\.[^/]+$/],
        runtimeCaching: [
          // ── API Caching ────────────────────────────────────────────────────────
          {
            urlPattern: /^https:\/\/aresfirst\.org\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ares-api-cache-v3',
              networkTimeoutSeconds: 10, // Fall back to cache after 10s
              expiration: {
                maxEntries: 500, // Increase from 100
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days (up from 1)
              },
              cacheableResponse: {
                statuses: [0, 200, 304] // Add 304 for Not Modified
              }
            }
          },

          // ── Static Assets ───────────────────────────────────────────────────────
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ares-images-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },

          // ── JavaScript/CSS ─────────────────────────────────────────────────────
          {
            urlPattern: /\.(?:js|css)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'ares-static-resources',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          },

          // ── Fonts ───────────────────────────────────────────────────────────────
          {
            urlPattern: /\.(?:woff|woff2|ttf|otf|eot)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ares-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },

          // ── Google Fonts ────────────────────────────────────────────────────────
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },

          // ── Google Fonts Static ────────────────────────────────────────────────
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      }
    })
  ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- VitePWA runtimeCaching type issue
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true
      }
    }
  },
  preview: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  build: {
    target: 'es2022',
    outDir: "dist",
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          // Normalize path separators for cross-platform consistency (Windows \ vs Linux /)
          const normalizedId = id.replace(/\\/g, '/');

          // ── Vendor isolation: route node_modules by package path ──

          // Editor: Tiptap + ProseMirror core (the biggest offender)
          if (normalizedId.includes("node_modules/@tiptap/") || normalizedId.includes("node_modules/prosemirror-") || normalizedId.includes("node_modules/@tiptap/pm")) {
            return "editor";
          }

          // Code highlighting & syntax (co-located with markdown to avoid circular chunks)
          // NOTE: react-syntax-highlighter and markdown/rehype share dependencies.
          //       Splitting them causes: Circular chunk: syntax -> markdown -> syntax
          if (normalizedId.includes("node_modules/highlight.js") || normalizedId.includes("node_modules/lowlight") || normalizedId.includes("node_modules/katex") || normalizedId.includes("node_modules/react-syntax-highlighter")) {
            return "markdown";
          }

          // Icons: lucide-react ships 1500+ icon components
          if (normalizedId.includes("node_modules/lucide-react")) {
            return "icons";
          }

          // Media processing: heic2any is 1.3MB alone
          if (normalizedId.includes("node_modules/heic2any")) {
            return "media";
          }

          // Monaco Editor
          if (normalizedId.includes("node_modules/monaco-editor") || normalizedId.includes("node_modules/@monaco-editor")) {
            return "monaco";
          }
          if (normalizedId.includes("node_modules/monaco-vim")) {
            return "monaco-vim";
          }

          // Babel for in-browser transpilation
          if (normalizedId.includes("node_modules/@babel/")) {
            return "babel";
          }

          // Document import
          if (normalizedId.includes("node_modules/mammoth")) {
            return "mammoth";
          }

          // 3D visualization
          if (normalizedId.includes("node_modules/three") || normalizedId.includes("node_modules/@react-three/")) {
            return "threejs";
          }

          // Flow diagrams
          if (normalizedId.includes("node_modules/@xyflow/")) {
            return "flow";
          }

          // Analytics charts
          if (normalizedId.includes("node_modules/@tremor/")) {
            return "tremor";
          }

          // Animation
          if (normalizedId.includes("node_modules/framer-motion")) {
            return "motion";
          }

          // Router
          if (normalizedId.includes("node_modules/react-router")) {
            return "router";
          }

          // UI primitives (Radix, Headless UI, dnd-kit)
          if (normalizedId.includes("node_modules/@radix-ui/") || normalizedId.includes("node_modules/@headlessui/") || normalizedId.includes("node_modules/@dnd-kit/")) {
            return "ui-primitives";
          }

          // DOMPurify + markdown rendering + syntax highlighting (unified to prevent circular chunks)
          if (normalizedId.includes("node_modules/dompurify") || normalizedId.includes("node_modules/react-markdown") || normalizedId.includes("node_modules/remark-") || normalizedId.includes("node_modules/rehype-")) {
            return "markdown";
          }

          // ── Application-specific chunks ─────────────────────────────────

          // Simulation-heavy code (R3F, Matter.js, physics)
          if (normalizedId.includes("src/sims/") ||
              normalizedId.includes("src/components/SimulationPlayground") ||
              normalizedId.includes("src/components/SimManager") ||
              normalizedId.includes("src/components/editor/Sim")) {
            return "simulation";
          }

          // Dashboard-specific components (charts, tables, admin)
          if (normalizedId.includes("src/components/dashboard/") &&
              !normalizedId.includes("src/components/dashboard/DashboardSidebar") &&
              !normalizedId.includes("src/components/dashboard/DashboardRoutes")) {
            return "dashboard-features";
          }

          // Editor components (BlogEditor, EventEditor, DocsEditor)
          if (normalizedId.includes("src/components/BlogEditor") ||
              normalizedId.includes("src/components/EventEditor") ||
              normalizedId.includes("src/components/DocsEditor") ||
              normalizedId.includes("src/components/ContentManager")) {
            return "content-editors";
          }

          // Forms and input-heavy components
          if (normalizedId.includes("src/components/ProfileEditor") ||
              normalizedId.includes("src/components/SeasonEditor") ||
              normalizedId.includes("src/components/SponsorEditor") ||
              normalizedId.includes("src/components/FinanceManager")) {
            return "forms";
          }

          // Analytics and charts (Tremor)
          if (normalizedId.includes("src/components/AnalyticsDashboard") ||
              normalizedId.includes("src/components/DietarySummary") ||
              normalizedId.includes("src/components/MemberImpactOverview") ||
              normalizedId.includes("node_modules/@tremor/")) {
            return "analytics";
          }

          // Keep shared components in main chunk
          if (normalizedId.includes("src/components/Navbar") ||
              normalizedId.includes("src/components/Footer") ||
              normalizedId.includes("src/components/ErrorBoundary")) {
            return "layout";
          }

          // React core (shared across all chunks)
          if (normalizedId.includes("node_modules/react/") || normalizedId.includes("node_modules/react-dom/")) {
            return "react-vendor";
          }

          // TanStack query + table (shared data layer)
          if (normalizedId.includes("node_modules/@tanstack/")) {
            return "tanstack";
          }

          // Yjs and collaborative editing
          if (normalizedId.includes("node_modules/yjs") || 
              normalizedId.includes("node_modules/y-") || 
              normalizedId.includes("node_modules/lib0") ||
              normalizedId.includes("node_modules/partykit") ||
              normalizedId.includes("node_modules/partysocket")) {
            return "yjs";
          }
          
          // Blockly
          if (normalizedId.includes("node_modules/blockly")) {
            return "blockly";
          }
        },
      },
    },
  },
});
