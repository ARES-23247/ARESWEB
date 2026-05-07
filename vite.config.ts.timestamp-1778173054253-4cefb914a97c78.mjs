// vite.config.ts
import { defineConfig } from "file:///C:/Users/david/dev/robotics/ftc/ARESWEB/node_modules/vitest/dist/config.js";
import react from "file:///C:/Users/david/dev/robotics/ftc/ARESWEB/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/david/dev/robotics/ftc/ARESWEB/node_modules/vite-plugin-pwa/dist/index.js";
import { visualizer } from "file:///C:/Users/david/dev/robotics/ftc/ARESWEB/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
import { imagetools } from "file:///C:/Users/david/dev/robotics/ftc/ARESWEB/node_modules/vite-imagetools/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "C:\\Users\\david\\dev\\robotics\\ftc\\ARESWEB";
var vite_config_default = defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
    exclude: ["**/node_modules/**", "tests/e2e/**", ".claude/**"],
    coverage: {
      provider: "v8",
      include: ["src/utils/**", "src/hooks/**", "functions/api/routes/**"],
      exclude: [
        "functions/api/routes/sitemap.ts",
        "**/*.test.ts"
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
    react(),
    imagetools({
      include: ["**/*.{png,jpg,jpeg}"],
      defaultDirectives: new URLSearchParams({
        format: "webp",
        quality: "85"
      })
    }),
    visualizer({ emitFile: true, filename: "stats.html" }),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "ares_hero.png"],
      manifest: {
        name: "ARES 23247 Web Portal",
        short_name: "ARES",
        description: "FIRST Tech Challenge Team 23247 - Appalachian Robotics & Engineering Society.",
        theme_color: "#C00000",
        background_color: "#09090b",
        display: "standalone",
        icons: [
          {
            src: "/ares_hero.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/ares_hero.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 15e6,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
        navigateFallback: null,
        navigateFallbackDenylist: [/^\/api\//, /\/[^/]+\.[^/]+$/],
        runtimeCaching: [
          // ── API Caching ────────────────────────────────────────────────────────
          {
            urlPattern: /^https:\/\/aresfirst\.org\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "ares-api-cache-v3",
              networkTimeoutSeconds: 10,
              // Fall back to cache after 10s
              expiration: {
                maxEntries: 500,
                // Increase from 100
                maxAgeSeconds: 60 * 60 * 24 * 7
                // 7 days (up from 1)
              },
              cacheableResponse: {
                statuses: [0, 200, 304]
                // Add 304 for Not Modified
              }
            }
          },
          // ── Static Assets ───────────────────────────────────────────────────────
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "ares-images-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30
                // 30 days
              }
            }
          },
          // ── JavaScript/CSS ─────────────────────────────────────────────────────
          {
            urlPattern: /\.(?:js|css)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "ares-static-resources",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7
                // 7 days
              }
            }
          },
          // ── Fonts ───────────────────────────────────────────────────────────────
          {
            urlPattern: /\.(?:woff|woff2|ttf|otf|eot)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "ares-fonts-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365
                // 1 year
              }
            }
          },
          // ── Google Fonts ────────────────────────────────────────────────────────
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365
                // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // ── Google Fonts Static ────────────────────────────────────────────────
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365
                // 1 year
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true
      }
    }
  },
  preview: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      "@shared": path.resolve(__vite_injected_original_dirname, "./shared")
    }
  },
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: "hidden",
    chunkSizeWarningLimit: 1e3,
    rollupOptions: {
      output: {
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (normalizedId.includes("node_modules/@tiptap/") || normalizedId.includes("node_modules/prosemirror-") || normalizedId.includes("node_modules/@tiptap/pm")) {
            return "editor";
          }
          if (normalizedId.includes("node_modules/highlight.js") || normalizedId.includes("node_modules/lowlight") || normalizedId.includes("node_modules/katex") || normalizedId.includes("node_modules/react-syntax-highlighter")) {
            return "markdown";
          }
          if (normalizedId.includes("node_modules/lucide-react")) {
            return "icons";
          }
          if (normalizedId.includes("node_modules/heic2any")) {
            return "media";
          }
          if (normalizedId.includes("node_modules/monaco-editor") || normalizedId.includes("node_modules/@monaco-editor")) {
            return "monaco";
          }
          if (normalizedId.includes("node_modules/monaco-vim")) {
            return "monaco-vim";
          }
          if (normalizedId.includes("node_modules/@babel/")) {
            return "babel";
          }
          if (normalizedId.includes("node_modules/mammoth")) {
            return "mammoth";
          }
          if (normalizedId.includes("node_modules/three") || normalizedId.includes("node_modules/@react-three/")) {
            return "threejs";
          }
          if (normalizedId.includes("node_modules/@xyflow/")) {
            return "flow";
          }
          if (normalizedId.includes("node_modules/@tremor/")) {
            return "tremor";
          }
          if (normalizedId.includes("node_modules/framer-motion")) {
            return "motion";
          }
          if (normalizedId.includes("node_modules/react-router")) {
            return "router";
          }
          if (normalizedId.includes("node_modules/@radix-ui/") || normalizedId.includes("node_modules/@headlessui/") || normalizedId.includes("node_modules/@dnd-kit/")) {
            return "ui-primitives";
          }
          if (normalizedId.includes("node_modules/dompurify") || normalizedId.includes("node_modules/react-markdown") || normalizedId.includes("node_modules/remark-") || normalizedId.includes("node_modules/rehype-")) {
            return "markdown";
          }
          if (normalizedId.includes("src/sims/") || normalizedId.includes("src/components/SimulationPlayground") || normalizedId.includes("src/components/SimManager") || normalizedId.includes("src/components/editor/Sim")) {
            return "simulation";
          }
          if (normalizedId.includes("src/components/dashboard/") && !normalizedId.includes("src/components/dashboard/DashboardSidebar") && !normalizedId.includes("src/components/dashboard/DashboardRoutes")) {
            return "dashboard-features";
          }
          if (normalizedId.includes("src/components/BlogEditor") || normalizedId.includes("src/components/EventEditor") || normalizedId.includes("src/components/DocsEditor") || normalizedId.includes("src/components/ContentManager")) {
            return "content-editors";
          }
          if (normalizedId.includes("src/components/ProfileEditor") || normalizedId.includes("src/components/SeasonEditor") || normalizedId.includes("src/components/SponsorEditor") || normalizedId.includes("src/components/FinanceManager")) {
            return "forms";
          }
          if (normalizedId.includes("src/components/AnalyticsDashboard") || normalizedId.includes("src/components/DietarySummary") || normalizedId.includes("src/components/MemberImpactOverview") || normalizedId.includes("node_modules/@tremor/")) {
            return "analytics";
          }
          if (normalizedId.includes("src/components/Navbar") || normalizedId.includes("src/components/Footer") || normalizedId.includes("src/components/ErrorBoundary")) {
            return "layout";
          }
          if (normalizedId.includes("node_modules/react/") || normalizedId.includes("node_modules/react-dom/")) {
            return "react-vendor";
          }
          if (normalizedId.includes("node_modules/@tanstack/")) {
            return "tanstack";
          }
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxkYXZpZFxcXFxkZXZcXFxccm9ib3RpY3NcXFxcZnRjXFxcXEFSRVNXRUJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGRhdmlkXFxcXGRldlxcXFxyb2JvdGljc1xcXFxmdGNcXFxcQVJFU1dFQlxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvZGF2aWQvZGV2L3JvYm90aWNzL2Z0Yy9BUkVTV0VCL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVzdC9jb25maWdcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSBcInZpdGUtcGx1Z2luLXB3YVwiO1xyXG5pbXBvcnQgeyB2aXN1YWxpemVyIH0gZnJvbSBcInJvbGx1cC1wbHVnaW4tdmlzdWFsaXplclwiO1xyXG5pbXBvcnQgeyBpbWFnZXRvb2xzIH0gZnJvbSBcInZpdGUtaW1hZ2V0b29sc1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICB0ZXN0OiB7XHJcbiAgICBlbnZpcm9ubWVudDogXCJqc2RvbVwiLFxyXG4gICAgc2V0dXBGaWxlczogXCIuL3NyYy90ZXN0L3NldHVwLnRzXCIsXHJcbiAgICBnbG9iYWxzOiB0cnVlLFxyXG4gICAgZXhjbHVkZTogWycqKi9ub2RlX21vZHVsZXMvKionLCAndGVzdHMvZTJlLyoqJywgJy5jbGF1ZGUvKionXSxcclxuICAgIGNvdmVyYWdlOiB7XHJcbiAgICAgIHByb3ZpZGVyOiBcInY4XCIsXHJcbiAgICAgIGluY2x1ZGU6IFsnc3JjL3V0aWxzLyoqJywgJ3NyYy9ob29rcy8qKicsICdmdW5jdGlvbnMvYXBpL3JvdXRlcy8qKiddLFxyXG4gICAgICBleGNsdWRlOiBbXHJcbiAgICAgICAgJ2Z1bmN0aW9ucy9hcGkvcm91dGVzL3NpdGVtYXAudHMnLFxyXG4gICAgICAgICcqKi8qLnRlc3QudHMnXHJcbiAgICAgIF0sXHJcbiAgICAgIHRocmVzaG9sZHM6IHtcclxuICAgICAgICBsaW5lczogODUsXHJcbiAgICAgICAgZnVuY3Rpb25zOiAxMDAsXHJcbiAgICAgICAgYnJhbmNoZXM6IDgwLFxyXG4gICAgICAgIHN0YXRlbWVudHM6IDg1XHJcbiAgICAgIH1cclxuICAgIH0sXHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgZGVwczoge1xyXG4gICAgICAgIGV4dGVybmFsOiBbL3BhcnNlNS9dXHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9LFxyXG4gIHBsdWdpbnM6IFtcclxuICAgIHJlYWN0KCksXHJcbiAgICBpbWFnZXRvb2xzKHtcclxuICAgICAgaW5jbHVkZTogWycqKi8qLntwbmcsanBnLGpwZWd9J10sXHJcbiAgICAgIGRlZmF1bHREaXJlY3RpdmVzOiBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcclxuICAgICAgICBmb3JtYXQ6ICd3ZWJwJyxcclxuICAgICAgICBxdWFsaXR5OiAnODUnLFxyXG4gICAgICB9KSxcclxuICAgIH0pLFxyXG4gICAgdmlzdWFsaXplcih7IGVtaXRGaWxlOiB0cnVlLCBmaWxlbmFtZTogXCJzdGF0cy5odG1sXCIgfSksXHJcbiAgICBWaXRlUFdBKHtcclxuICAgICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsXHJcbiAgICAgIGluamVjdFJlZ2lzdGVyOiAnYXV0bycsXHJcbiAgICAgIGluY2x1ZGVBc3NldHM6IFsnZmF2aWNvbi5pY28nLCAnYXBwbGUtdG91Y2gtaWNvbi5wbmcnLCAnYXJlc19oZXJvLnBuZyddLFxyXG4gICAgICBtYW5pZmVzdDoge1xyXG4gICAgICAgIG5hbWU6ICdBUkVTIDIzMjQ3IFdlYiBQb3J0YWwnLFxyXG4gICAgICAgIHNob3J0X25hbWU6ICdBUkVTJyxcclxuICAgICAgICBkZXNjcmlwdGlvbjogJ0ZJUlNUIFRlY2ggQ2hhbGxlbmdlIFRlYW0gMjMyNDcgLSBBcHBhbGFjaGlhbiBSb2JvdGljcyAmIEVuZ2luZWVyaW5nIFNvY2lldHkuJyxcclxuICAgICAgICB0aGVtZV9jb2xvcjogJyNDMDAwMDAnLFxyXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjMDkwOTBiJyxcclxuICAgICAgICBkaXNwbGF5OiAnc3RhbmRhbG9uZScsXHJcbiAgICAgICAgaWNvbnM6IFtcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgc3JjOiAnL2FyZXNfaGVyby5wbmcnLFxyXG4gICAgICAgICAgICBzaXplczogJzE5MngxOTInLFxyXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJ1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgc3JjOiAnL2FyZXNfaGVyby5wbmcnLFxyXG4gICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxyXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcclxuICAgICAgICAgICAgcHVycG9zZTogJ2FueSBtYXNrYWJsZSdcclxuICAgICAgICAgIH1cclxuICAgICAgICBdXHJcbiAgICAgIH0sXHJcbiAgICAgIHdvcmtib3g6IHtcclxuICAgICAgICBza2lwV2FpdGluZzogdHJ1ZSxcclxuICAgICAgICBjbGllbnRzQ2xhaW06IHRydWUsXHJcbiAgICAgICAgbWF4aW11bUZpbGVTaXplVG9DYWNoZUluQnl0ZXM6IDE1MDAwMDAwLFxyXG4gICAgICAgIGdsb2JQYXR0ZXJuczogWycqKi8qLntqcyxjc3MsaHRtbCxpY28scG5nLHN2Zyx3ZWJwfSddLFxyXG4gICAgICAgIG5hdmlnYXRlRmFsbGJhY2s6IG51bGwsXHJcbiAgICAgICAgbmF2aWdhdGVGYWxsYmFja0RlbnlsaXN0OiBbL15cXC9hcGlcXC8vLCAvXFwvW14vXStcXC5bXi9dKyQvXSxcclxuICAgICAgICBydW50aW1lQ2FjaGluZzogW1xyXG4gICAgICAgICAgLy8gXHUyNTAwXHUyNTAwIEFQSSBDYWNoaW5nIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL2FyZXNmaXJzdFxcLm9yZ1xcL2FwaVxcLy4qL2ksXHJcbiAgICAgICAgICAgIGhhbmRsZXI6ICdOZXR3b3JrRmlyc3QnLFxyXG4gICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnYXJlcy1hcGktY2FjaGUtdjMnLFxyXG4gICAgICAgICAgICAgIG5ldHdvcmtUaW1lb3V0U2Vjb25kczogMTAsIC8vIEZhbGwgYmFjayB0byBjYWNoZSBhZnRlciAxMHNcclxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICBtYXhFbnRyaWVzOiA1MDAsIC8vIEluY3JlYXNlIGZyb20gMTAwXHJcbiAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiA3IC8vIDcgZGF5cyAodXAgZnJvbSAxKVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgY2FjaGVhYmxlUmVzcG9uc2U6IHtcclxuICAgICAgICAgICAgICAgIHN0YXR1c2VzOiBbMCwgMjAwLCAzMDRdIC8vIEFkZCAzMDQgZm9yIE5vdCBNb2RpZmllZFxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAvLyBcdTI1MDBcdTI1MDAgU3RhdGljIEFzc2V0cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgdXJsUGF0dGVybjogL1xcLig/OnBuZ3xqcGd8anBlZ3xzdmd8Z2lmfHdlYnB8YXZpZnxpY28pJC9pLFxyXG4gICAgICAgICAgICBoYW5kbGVyOiAnQ2FjaGVGaXJzdCcsXHJcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdhcmVzLWltYWdlcy1jYWNoZScsXHJcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgbWF4RW50cmllczogMjAwLFxyXG4gICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMzAgLy8gMzAgZGF5c1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAvLyBcdTI1MDBcdTI1MDAgSmF2YVNjcmlwdC9DU1MgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9cXC4oPzpqc3xjc3MpJC9pLFxyXG4gICAgICAgICAgICBoYW5kbGVyOiAnU3RhbGVXaGlsZVJldmFsaWRhdGUnLFxyXG4gICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnYXJlcy1zdGF0aWMtcmVzb3VyY2VzJyxcclxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICBtYXhFbnRyaWVzOiAxMDAsXHJcbiAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiA3IC8vIDcgZGF5c1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAvLyBcdTI1MDBcdTI1MDAgRm9udHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9cXC4oPzp3b2ZmfHdvZmYyfHR0ZnxvdGZ8ZW90KSQvaSxcclxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxyXG4gICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnYXJlcy1mb250cy1jYWNoZScsXHJcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgbWF4RW50cmllczogMjAsXHJcbiAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzNjUgLy8gMSB5ZWFyXHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9LFxyXG5cclxuICAgICAgICAgIC8vIFx1MjUwMFx1MjUwMCBHb29nbGUgRm9udHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvZm9udHNcXC5nb29nbGVhcGlzXFwuY29tXFwvLiovaSxcclxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxyXG4gICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnZ29vZ2xlLWZvbnRzLWNhY2hlJyxcclxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICBtYXhFbnRyaWVzOiAyMCxcclxuICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDM2NSAvLyAxIHllYXJcclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIGNhY2hlYWJsZVJlc3BvbnNlOiB7XHJcbiAgICAgICAgICAgICAgICBzdGF0dXNlczogWzAsIDIwMF1cclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0sXHJcblxyXG4gICAgICAgICAgLy8gXHUyNTAwXHUyNTAwIEdvb2dsZSBGb250cyBTdGF0aWMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvZm9udHNcXC5nc3RhdGljXFwuY29tXFwvLiovaSxcclxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxyXG4gICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnZ3N0YXRpYy1mb250cy1jYWNoZScsXHJcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgbWF4RW50cmllczogMjAsXHJcbiAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzNjUgLy8gMSB5ZWFyXHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgXVxyXG4gICAgICB9XHJcbiAgICB9KVxyXG4gIF0sXHJcbiAgc2VydmVyOiB7XHJcbiAgICBwcm94eToge1xyXG4gICAgICAnL2FwaSc6IHtcclxuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjg3ODgnLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSxcclxuICBwcmV2aWV3OiB7XHJcbiAgICBwcm94eToge1xyXG4gICAgICAnL2FwaSc6IHtcclxuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjg3ODgnLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcclxuICAgICAgXCJAc2hhcmVkXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zaGFyZWRcIiksXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIHRhcmdldDogJ2VzMjAyMicsXHJcbiAgICBvdXREaXI6IFwiZGlzdFwiLFxyXG4gICAgc291cmNlbWFwOiAnaGlkZGVuJyxcclxuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAwMCxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgY2h1bmtGaWxlTmFtZXM6ICdhc3NldHMvW25hbWVdLVtoYXNoXS5qcycsXHJcbiAgICAgICAgZW50cnlGaWxlTmFtZXM6ICdhc3NldHMvW25hbWVdLVtoYXNoXS5qcycsXHJcbiAgICAgICAgYXNzZXRGaWxlTmFtZXM6ICdhc3NldHMvW25hbWVdLVtoYXNoXS5bZXh0XScsXHJcbiAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XHJcbiAgICAgICAgICAvLyBOb3JtYWxpemUgcGF0aCBzZXBhcmF0b3JzIGZvciBjcm9zcy1wbGF0Zm9ybSBjb25zaXN0ZW5jeSAoV2luZG93cyBcXCB2cyBMaW51eCAvKVxyXG4gICAgICAgICAgY29uc3Qgbm9ybWFsaXplZElkID0gaWQucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xyXG5cclxuICAgICAgICAgIC8vIFx1MjUwMFx1MjUwMCBWZW5kb3IgaXNvbGF0aW9uOiByb3V0ZSBub2RlX21vZHVsZXMgYnkgcGFja2FnZSBwYXRoIFx1MjUwMFx1MjUwMFxyXG5cclxuICAgICAgICAgIC8vIEVkaXRvcjogVGlwdGFwICsgUHJvc2VNaXJyb3IgY29yZSAodGhlIGJpZ2dlc3Qgb2ZmZW5kZXIpXHJcbiAgICAgICAgICBpZiAobm9ybWFsaXplZElkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL0B0aXB0YXAvXCIpIHx8IG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9wcm9zZW1pcnJvci1cIikgfHwgbm9ybWFsaXplZElkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL0B0aXB0YXAvcG1cIikpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwiZWRpdG9yXCI7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gQ29kZSBoaWdobGlnaHRpbmcgJiBzeW50YXggKGNvLWxvY2F0ZWQgd2l0aCBtYXJrZG93biB0byBhdm9pZCBjaXJjdWxhciBjaHVua3MpXHJcbiAgICAgICAgICAvLyBOT1RFOiByZWFjdC1zeW50YXgtaGlnaGxpZ2h0ZXIgYW5kIG1hcmtkb3duL3JlaHlwZSBzaGFyZSBkZXBlbmRlbmNpZXMuXHJcbiAgICAgICAgICAvLyAgICAgICBTcGxpdHRpbmcgdGhlbSBjYXVzZXM6IENpcmN1bGFyIGNodW5rOiBzeW50YXggLT4gbWFya2Rvd24gLT4gc3ludGF4XHJcbiAgICAgICAgICBpZiAobm9ybWFsaXplZElkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL2hpZ2hsaWdodC5qc1wiKSB8fCBub3JtYWxpemVkSWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvbG93bGlnaHRcIikgfHwgbm9ybWFsaXplZElkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL2thdGV4XCIpIHx8IG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC1zeW50YXgtaGlnaGxpZ2h0ZXJcIikpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwibWFya2Rvd25cIjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBJY29uczogbHVjaWRlLXJlYWN0IHNoaXBzIDE1MDArIGljb24gY29tcG9uZW50c1xyXG4gICAgICAgICAgaWYgKG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9sdWNpZGUtcmVhY3RcIikpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwiaWNvbnNcIjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBNZWRpYSBwcm9jZXNzaW5nOiBoZWljMmFueSBpcyAxLjNNQiBhbG9uZVxyXG4gICAgICAgICAgaWYgKG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9oZWljMmFueVwiKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJtZWRpYVwiO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIE1vbmFjbyBFZGl0b3JcclxuICAgICAgICAgIGlmIChub3JtYWxpemVkSWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvbW9uYWNvLWVkaXRvclwiKSB8fCBub3JtYWxpemVkSWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvQG1vbmFjby1lZGl0b3JcIikpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwibW9uYWNvXCI7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZiAobm9ybWFsaXplZElkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL21vbmFjby12aW1cIikpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwibW9uYWNvLXZpbVwiO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIEJhYmVsIGZvciBpbi1icm93c2VyIHRyYW5zcGlsYXRpb25cclxuICAgICAgICAgIGlmIChub3JtYWxpemVkSWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvQGJhYmVsL1wiKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJiYWJlbFwiO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIERvY3VtZW50IGltcG9ydFxyXG4gICAgICAgICAgaWYgKG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9tYW1tb3RoXCIpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcIm1hbW1vdGhcIjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyAzRCB2aXN1YWxpemF0aW9uXHJcbiAgICAgICAgICBpZiAobm9ybWFsaXplZElkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL3RocmVlXCIpIHx8IG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9AcmVhY3QtdGhyZWUvXCIpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcInRocmVlanNcIjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBGbG93IGRpYWdyYW1zXHJcbiAgICAgICAgICBpZiAobm9ybWFsaXplZElkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL0B4eWZsb3cvXCIpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcImZsb3dcIjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBBbmFseXRpY3MgY2hhcnRzXHJcbiAgICAgICAgICBpZiAobm9ybWFsaXplZElkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL0B0cmVtb3IvXCIpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcInRyZW1vclwiO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIEFuaW1hdGlvblxyXG4gICAgICAgICAgaWYgKG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9mcmFtZXItbW90aW9uXCIpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcIm1vdGlvblwiO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIFJvdXRlclxyXG4gICAgICAgICAgaWYgKG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC1yb3V0ZXJcIikpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwicm91dGVyXCI7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gVUkgcHJpbWl0aXZlcyAoUmFkaXgsIEhlYWRsZXNzIFVJLCBkbmQta2l0KVxyXG4gICAgICAgICAgaWYgKG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9AcmFkaXgtdWkvXCIpIHx8IG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9AaGVhZGxlc3N1aS9cIikgfHwgbm9ybWFsaXplZElkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL0BkbmQta2l0L1wiKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJ1aS1wcmltaXRpdmVzXCI7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gRE9NUHVyaWZ5ICsgbWFya2Rvd24gcmVuZGVyaW5nICsgc3ludGF4IGhpZ2hsaWdodGluZyAodW5pZmllZCB0byBwcmV2ZW50IGNpcmN1bGFyIGNodW5rcylcclxuICAgICAgICAgIGlmIChub3JtYWxpemVkSWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvZG9tcHVyaWZ5XCIpIHx8IG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC1tYXJrZG93blwiKSB8fCBub3JtYWxpemVkSWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvcmVtYXJrLVwiKSB8fCBub3JtYWxpemVkSWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvcmVoeXBlLVwiKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJtYXJrZG93blwiO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIFx1MjUwMFx1MjUwMCBBcHBsaWNhdGlvbi1zcGVjaWZpYyBjaHVua3MgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHJcblxyXG4gICAgICAgICAgLy8gU2ltdWxhdGlvbi1oZWF2eSBjb2RlIChSM0YsIE1hdHRlci5qcywgcGh5c2ljcylcclxuICAgICAgICAgIGlmIChub3JtYWxpemVkSWQuaW5jbHVkZXMoXCJzcmMvc2ltcy9cIikgfHxcclxuICAgICAgICAgICAgICBub3JtYWxpemVkSWQuaW5jbHVkZXMoXCJzcmMvY29tcG9uZW50cy9TaW11bGF0aW9uUGxheWdyb3VuZFwiKSB8fFxyXG4gICAgICAgICAgICAgIG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcInNyYy9jb21wb25lbnRzL1NpbU1hbmFnZXJcIikgfHxcclxuICAgICAgICAgICAgICBub3JtYWxpemVkSWQuaW5jbHVkZXMoXCJzcmMvY29tcG9uZW50cy9lZGl0b3IvU2ltXCIpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcInNpbXVsYXRpb25cIjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBEYXNoYm9hcmQtc3BlY2lmaWMgY29tcG9uZW50cyAoY2hhcnRzLCB0YWJsZXMsIGFkbWluKVxyXG4gICAgICAgICAgaWYgKG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcInNyYy9jb21wb25lbnRzL2Rhc2hib2FyZC9cIikgJiZcclxuICAgICAgICAgICAgICAhbm9ybWFsaXplZElkLmluY2x1ZGVzKFwic3JjL2NvbXBvbmVudHMvZGFzaGJvYXJkL0Rhc2hib2FyZFNpZGViYXJcIikgJiZcclxuICAgICAgICAgICAgICAhbm9ybWFsaXplZElkLmluY2x1ZGVzKFwic3JjL2NvbXBvbmVudHMvZGFzaGJvYXJkL0Rhc2hib2FyZFJvdXRlc1wiKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJkYXNoYm9hcmQtZmVhdHVyZXNcIjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBFZGl0b3IgY29tcG9uZW50cyAoQmxvZ0VkaXRvciwgRXZlbnRFZGl0b3IsIERvY3NFZGl0b3IpXHJcbiAgICAgICAgICBpZiAobm9ybWFsaXplZElkLmluY2x1ZGVzKFwic3JjL2NvbXBvbmVudHMvQmxvZ0VkaXRvclwiKSB8fFxyXG4gICAgICAgICAgICAgIG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcInNyYy9jb21wb25lbnRzL0V2ZW50RWRpdG9yXCIpIHx8XHJcbiAgICAgICAgICAgICAgbm9ybWFsaXplZElkLmluY2x1ZGVzKFwic3JjL2NvbXBvbmVudHMvRG9jc0VkaXRvclwiKSB8fFxyXG4gICAgICAgICAgICAgIG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcInNyYy9jb21wb25lbnRzL0NvbnRlbnRNYW5hZ2VyXCIpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcImNvbnRlbnQtZWRpdG9yc1wiO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIEZvcm1zIGFuZCBpbnB1dC1oZWF2eSBjb21wb25lbnRzXHJcbiAgICAgICAgICBpZiAobm9ybWFsaXplZElkLmluY2x1ZGVzKFwic3JjL2NvbXBvbmVudHMvUHJvZmlsZUVkaXRvclwiKSB8fFxyXG4gICAgICAgICAgICAgIG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcInNyYy9jb21wb25lbnRzL1NlYXNvbkVkaXRvclwiKSB8fFxyXG4gICAgICAgICAgICAgIG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcInNyYy9jb21wb25lbnRzL1Nwb25zb3JFZGl0b3JcIikgfHxcclxuICAgICAgICAgICAgICBub3JtYWxpemVkSWQuaW5jbHVkZXMoXCJzcmMvY29tcG9uZW50cy9GaW5hbmNlTWFuYWdlclwiKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJmb3Jtc1wiO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIEFuYWx5dGljcyBhbmQgY2hhcnRzIChUcmVtb3IpXHJcbiAgICAgICAgICBpZiAobm9ybWFsaXplZElkLmluY2x1ZGVzKFwic3JjL2NvbXBvbmVudHMvQW5hbHl0aWNzRGFzaGJvYXJkXCIpIHx8XHJcbiAgICAgICAgICAgICAgbm9ybWFsaXplZElkLmluY2x1ZGVzKFwic3JjL2NvbXBvbmVudHMvRGlldGFyeVN1bW1hcnlcIikgfHxcclxuICAgICAgICAgICAgICBub3JtYWxpemVkSWQuaW5jbHVkZXMoXCJzcmMvY29tcG9uZW50cy9NZW1iZXJJbXBhY3RPdmVydmlld1wiKSB8fFxyXG4gICAgICAgICAgICAgIG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9AdHJlbW9yL1wiKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJhbmFseXRpY3NcIjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBLZWVwIHNoYXJlZCBjb21wb25lbnRzIGluIG1haW4gY2h1bmtcclxuICAgICAgICAgIGlmIChub3JtYWxpemVkSWQuaW5jbHVkZXMoXCJzcmMvY29tcG9uZW50cy9OYXZiYXJcIikgfHxcclxuICAgICAgICAgICAgICBub3JtYWxpemVkSWQuaW5jbHVkZXMoXCJzcmMvY29tcG9uZW50cy9Gb290ZXJcIikgfHxcclxuICAgICAgICAgICAgICBub3JtYWxpemVkSWQuaW5jbHVkZXMoXCJzcmMvY29tcG9uZW50cy9FcnJvckJvdW5kYXJ5XCIpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcImxheW91dFwiO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIFJlYWN0IGNvcmUgKHNoYXJlZCBhY3Jvc3MgYWxsIGNodW5rcylcclxuICAgICAgICAgIGlmIChub3JtYWxpemVkSWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvcmVhY3QvXCIpIHx8IG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC1kb20vXCIpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcInJlYWN0LXZlbmRvclwiO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIFRhblN0YWNrIHF1ZXJ5ICsgdGFibGUgKHNoYXJlZCBkYXRhIGxheWVyKVxyXG4gICAgICAgICAgaWYgKG5vcm1hbGl6ZWRJZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9AdGFuc3RhY2svXCIpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcInRhbnN0YWNrXCI7XHJcbiAgICAgICAgICB9XHJcbiAgICAg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
