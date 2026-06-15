import { defineConfig } from "vitest/config";

// Standalone vitest config (does not load vite.config.ts / the Svelte plugin).
// Logic tests run in a plain Node environment; the Worker is stubbed per-test.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
