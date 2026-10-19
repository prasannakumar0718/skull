import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/temp*/**", "**/fixtures/**"],
    testTimeout: 45000
  }
});
