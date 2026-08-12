import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import security from "eslint-plugin-security";

export default tseslint.config(
  {
    ignores: [
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
      "ci-report/**",
      "scratch/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommended],
    plugins: {
      "react-hooks": reactHooks,
      security,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-undef": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "security/detect-unsafe-regex": "warn",
    },
  },
  {
    files: ["e2e/**/*.{ts,tsx}"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
);
