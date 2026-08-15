import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Declared locally rather than pulling in @types/node for a single lookup.
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/, so the deploy workflow sets
  // this. Local dev and any root-domain host need no configuration.
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react(), tailwindcss()],
});
