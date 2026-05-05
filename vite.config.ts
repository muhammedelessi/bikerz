import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const rawBase = env.VITE_ASSET_BASE_URL?.trim();
  const base = rawBase ? (rawBase.endsWith("/") ? rawBase : `${rawBase}/`) : "/";

  return ({
  base,
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "robots.txt", "sitemap.xml", "favicon.ico", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Bikerz Academy",
        short_name: "Bikerz",
        description: "أكاديمية بايكرز للتدريب على ركوب الدراجات النارية",
        theme_color: "#0F4C81",
        background_color: "#FFFFFF",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // skipWaiting: true  — the new service worker activates immediately
        // instead of waiting for all tabs to close. Paired with clientsClaim
        // this ensures users get the updated JS bundle on the very next page
        // load, without having to close their browser tab first.
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,avif,woff2,woff,ttf,json,xml,txt}"],
        // Workbox's default `navigateFallback: '/index.html'` rewrites EVERY
        // navigation request to the SPA shell — including requests for static
        // HTML files like /tap-3ds-callback.html. That's the SPA pattern
        // working as designed everywhere except for "real" HTML pages we
        // serve outside React. Without this denylist, after Tap's 3DS flow
        // redirects the iframe to /tap-3ds-callback.html, the SW serves
        // /index.html, React Router doesn't match the path, and NotFound
        // renders inside the modal — the 404 the user reported after
        // submitting OTP. Listing the path here makes the SW fall through
        // to the normal precache fetch (the file IS in precache via the
        // glob above) so the original static HTML is delivered.
        navigateFallbackDenylist: [
          /^\/tap-3ds-callback(\.html)?$/,
          // Apple Pay merchant-id verification — also a real file that must
          // not be rewritten to the SPA shell.
          /^\/\.well-known\//,
          // SEO files — must be served as-is so crawlers get the real
          // XML/text content instead of the SPA shell (which renders a
          // React 404 page for unknown routes).
          /^\/sitemap\.xml$/,
          /^\/robots\.txt$/,
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\//,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Prevent "Invalid hook call" / dispatcher-null issues from duplicated React copies
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    target: "es2020",
    minify: 'esbuild',
    cssCodeSplit: true,
    cssMinify: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000,
    /** Smaller HTML / faster first chunk on slow networks */
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query", "@tanstack/query-core"],
          "vendor-ui": ["sonner"],
          "vendor-supabase": ["@supabase/supabase-js"],
          // recharts is NOT in manualChunks — Vite preloads vendor chunks
          // alongside the entry, which would force the home page to fetch
          // 422 kB of charts code that only admin analytics need. Letting
          // Rollup chunk recharts naturally keeps it on the lazy path.
        },
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  esbuild: {
    target: "es2020",
    legalComments: "none",
  },
});
});
