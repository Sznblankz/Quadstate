import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Standalone vitest config (does not load vite.config.ts / the Svelte plugin).
// Logic tests run in a plain Node environment; the Worker is stubbed per-test,
// and account.svelte.ts (whose $state rune needs the Svelte compiler) is
// swapped for a plain-object stub.
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^.*\/account\.svelte(\.js)?$/,
        replacement: fileURLToPath(new URL("./test/stubs/account.stub.ts", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
