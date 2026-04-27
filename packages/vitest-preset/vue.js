import { defineConfig, mergeConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

const baseConfig = defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});

/**
 * @param {import("vitest/config").UserConfig} [overrides]
 * @returns {import("vitest/config").UserConfig}
 */
export function createVueVitestConfig(overrides = {}) {
  return mergeConfig(baseConfig, overrides);
}
