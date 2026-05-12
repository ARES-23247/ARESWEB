import js from "@eslint/js";
import ts from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import security from "eslint-plugin-security";
import pluginQuery from "@tanstack/eslint-plugin-query";
import drizzle from "eslint-plugin-drizzle";
import globals from "globals";
import { fixupPluginRules } from "@eslint/compat";

export default ts.config(
  {
    ignores: [
      ".claude/**",
      ".agents/**", // Ignore AI agent skills and configs
      "dist",
      "coverage",
      ".wrangler",
      "ci-report",
      "playwright-report",
      "pw-report*/**",
      "test-results",
      "Roo-Code/**",
      "eslint.config.js",
      "**/*.bundle",
      "*.cjs", // Ignore legacy CommonJS utility scripts at root
      "scripts/*.cjs", // Ignore scripts
      "*.mjs", // Ignore ESM utility scripts at root
      "scratch/**", // Ignore scratch directory
      ".planning/scratch/**", // Ignore planning scratch files
      ".scripts/**", // Ignore utility scripts
      "public/vendor/**", // Ignore vendored third-party UMD bundles (React, ReactDOM)
      "src/components/generated/**", // Ignore auto-generated files
      "src/components/editor/physics/**", // Migrated from .eslintignore
      "migrations/**/*.sql", // Ignore SQL migration files
      "tools/ares-sim-preview/out", // Ignore compiled VSCode extension output
      ".vite/**", // Ignore Vite cache directory
      "src/components/SimulationPlayground.refactored.tsx", // WIP refactor draft
      "drizzle/**", // Ignore Drizzle Kit generated files
      "**/tmp/**", // Ignore temp directories anywhere
      "**/Temp/**", // Ignore Windows temp directories anywhere
      "**/AppData/Local/Temp/**", // Ignore Windows AppData temp
      "**/*.tmp", // Ignore temp files
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...pluginQuery.configs["flat/recommended"],
  {
    // Global settings for all files
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2020,
        ...globals.node,
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        process: "readonly",
      },
    },
  },
  {
    // TypeScript files in src and functions
    files: ["src/**/*.{ts,tsx}", "functions/**/*.{ts,tsx}", "shared/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      react,
      "react-hooks": fixupPluginRules(reactHooks),
      "jsx-a11y": jsxA11y,
      security,
      drizzle,
    },
    settings: {
      react: {
        version: "18.2",
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      ...security.configs.recommended.rules,
      
      // Accessibility overrides per ARESWEB standards
      "jsx-a11y/anchor-is-valid": [
        "error",
        {
          components: ["Link"],
          specialLink: ["to"],
        },
      ],
      "jsx-a11y/label-has-associated-control": [
        "error",
        {
          assert: "either",
        },
      ],
      
      // Developer Experience overrides
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-empty-object-type": "off",
      
      // Security overrides
      "security/detect-object-injection": "off",

      // Drizzle safety — prevent accidental table-wide operations
      // Scoped to known Drizzle identifiers to avoid false positives on
      // Map.delete(), URLSearchParams.delete(), http.delete(), cache.delete(), R2.delete(), etc.
      "drizzle/enforce-delete-with-where": ["error", { "drizzleObjectName": ["db", "mockDb"] }],
      "drizzle/enforce-update-with-where": ["error", { "drizzleObjectName": ["db", "mockDb"] }],

      // Project logic - ignore unused variables prefixed with _
      "no-unused-vars": "off", // use @typescript-eslint/no-unused-vars instead
      "react/prop-types": "off"
    },
  },
  {
    // Configuration files and scripts at root + tests
    files: ["*.ts", "tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-undef": "off",
    }
  }
);
