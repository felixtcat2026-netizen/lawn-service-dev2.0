import { defineConfig } from "vitest/config";
import path from "path";

// Separate from vitest.config.ts (unit tests) because these tests hit a
// real Supabase project over the network and need env vars loaded from
// .env.local -- see src/test/env-setup.ts and docs/BUILD-STATUS.md for
// what's required before `npm run test:integration` will pass.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/test/**/*.integration.test.ts"],
    setupFiles: ["src/test/env-setup.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
