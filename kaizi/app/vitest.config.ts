import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Runs pure-logic unit tests (state reducer, validators, formatters) under
 * plain Node — no Metro, no device/simulator. This is NOT a component test
 * setup: react-native and react-native-svg ship Flow syntax vitest can't
 * parse, so both are aliased to lightweight stubs (test/stubs/) purely so
 * files that import them for component plumbing can still be imported to
 * reach their exported pure functions. Do not use this config to render
 * components — the stubs are no-ops.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: path.resolve(dirname, "test/stubs/react-native.ts") },
      {
        find: /^react-native-svg$/,
        replacement: path.resolve(dirname, "test/stubs/react-native-svg.ts"),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
