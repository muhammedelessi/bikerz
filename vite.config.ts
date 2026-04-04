import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
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
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Prevent "Invalid hook call" / dispatcher-null issues from duplicated React copies
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query', '@tanstack/query-core'],
          'vendor-ui': ['framer-motion', 'lucide-react', 'sonner'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-editor': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-underline', '@tiptap/extension-text-align'],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
});
});
