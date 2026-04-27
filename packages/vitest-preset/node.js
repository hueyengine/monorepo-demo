import { defineConfig, mergeConfig } from "vitest/config";

const baseConfig = defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.{test,spec}.ts"],
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
export function createNodeVitestConfig(overrides = {}) {
  return mergeConfig(baseConfig, overrides);
}
