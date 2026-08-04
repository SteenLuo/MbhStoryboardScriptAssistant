import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  publicDir: false,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  plugins: [react()],
  build: {
    emptyOutDir: false,
    lib: {
      entry: path.resolve(import.meta.dirname, "canvas-client/main.jsx"),
      name: "MbhCanvasFlow",
      formats: ["iife"],
      fileName: () => "canvas-flow.js",
      cssFileName: "canvas-flow",
    },
    outDir: path.resolve(import.meta.dirname, "public/assets"),
    sourcemap: false,
  },
});
