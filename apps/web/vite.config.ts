import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { searchForWorkspaceRoot } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // `packages/shared` lives outside this app, so the dev server must be
    // allowed to read from the monorepo root.
    fs: { allow: [searchForWorkspaceRoot(process.cwd())] },
  },
  // `@naijaverse/shared` ships TypeScript source, not a build artefact.
  // Excluding it from pre-bundling lets Vite compile it through the same
  // pipeline as the rest of the app (and keeps HMR working on edits to it).
  optimizeDeps: {
    exclude: ["@naijaverse/shared"],
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 1600,
  },
});
