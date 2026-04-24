/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
    exclude: ['node_modules', 'tests/e2e/**'],
    coverage: {
      provider: "v8",
      include: ['src/utils/**', 'src/hooks/**', 'functions/api/routes/**'],
      exclude: [
        'functions/api/routes/github.ts',
        'functions/api/routes/githubWebhook.ts',
        'functions/api/routes/tba.ts',
        'functions/api/routes/events/sync.ts',
        'functions/api/routes/zulip.ts',
        'functions/api/routes/zulipWebhook.ts',
        'functions/api/routes/sitemap.ts',
        'functions/api/routes/logistics.ts',
        '**/*.test.ts'
      ],
      thresholds: {
        lines: 85,
        functions: 100,
        branches: 80,
        statements: 85
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'ares_hero.png'],
      manifest: {
        name: 'ARES 23247 Web Portal',
        short_name: 'ARES',
        description: 'FIRST Tech Challenge Team 23247 - Appalachian Robotics & Engineering Society.',
        theme_color: '#dc2626',
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
        navigateFallbackDenylist: [/^\/api\//, /\/[^/]+\.[^/]+$/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/ares23247\.com\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ares-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true
      }
    }
  },
  preview: {
    // No proxy — E2E tests run without a backend; API calls return 502 instantly
    proxy: {}
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          editor: ["@tiptap/react", "@tiptap/starter-kit"],
          router: ["react-router-dom"],
          motion: ["framer-motion"],
          icons: ["lucide-react"],
          media: ["heic2any"],
          threejs: ["three", "@react-three/fiber", "@react-three/drei"]
        },
      },
    },
  },
});
