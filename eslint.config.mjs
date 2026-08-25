import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // A leading underscore is the conventional marker for "deliberately
      // unused" — honouring it is better than deleting the parameter and
      // losing the signal about why it's there.
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated service worker — linting bundled/minified output is meaningless
    "public/sw.js",
    "public/sw.js.map",
    // Vendored MediaPipe wasm runtime, staged by scripts/fetch-pose-assets.mjs
    "public/mediapipe/**",
  ]),
]);

export default eslintConfig;
