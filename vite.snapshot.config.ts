import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "path";

// Builds the executive snapshot viewer as a single self-contained HTML file.
// The interactive app fetches this template and injects frozen snapshot data
// into the __SNAPSHOT_DATA__ placeholder script tag at generation time.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  root: path.resolve(__dirname, "src/snapshot"),
  // Tailwind runs through @tailwindcss/vite here; ignore the Next-oriented
  // postcss.config.mjs, whose string-plugin form Vite cannot load.
  css: { postcss: {} },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "public/snapshot"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 8000,
  },
});
