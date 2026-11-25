import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts so the Cloudflare/workerd plugin does not run
// during unit tests. Pure logic lives in src/shared/engine and is easy to test.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
