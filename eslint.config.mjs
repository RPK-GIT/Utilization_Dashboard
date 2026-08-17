import { defineConfig } from "eslint/config";
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

export default defineConfig([
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "dist/**",
      "public/**",
      "playwright-report/**",
      "test-results/**",
      "vendor/**",
    ],
  },
  coreWebVitals,
  typescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);
