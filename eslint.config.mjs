import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  globalIgnores([
    ".firebase/**",
    ".next/**",
    "dist/**",
    "functions/**",
    "node_modules/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "archive/**",
    "scripts/**",
    ".scripts/**",
    "src-tauri/**",
  ]),
]);

export default eslintConfig;
