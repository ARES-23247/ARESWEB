import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  globalIgnores([
    ".firebase/**",
    "dist/**",
    "functions/**",
    "node_modules/**",
    "build/**",
    "archive/**",
    "scripts/**",
    ".scripts/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
