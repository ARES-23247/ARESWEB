import js from "@eslint/js";
import ts from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import security from "eslint-plugin-security";
import globals from "globals";
import { fixupPluginRules } from "@eslint/compat";

export default ts.config(
  {
    ignores: [
      "dist",
      "coverage",
      ".wrangler",
      "playwright-report",
      "test-results",
      "eslint.config.js",
      "**/*.bundle",
      "*.cjs", // Ignore legacy CommonJS utility scripts at root
      "*.mjs", // Ignore ESM utility scripts at root
      "scratch/**" // Ignore scratch directory
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
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
    files: ["src/**/*.{ts,tsx}", "functions/**/*.{ts,tsx}"],
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
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      
      // Security overrides
      "security/detect-object-injection": "off",

      // Project logic - ignore unused variables prefixed with _
      "no-unused-vars": "off", // use @typescript-eslint/no-unused-vars instead
      "react/prop-types": "off"
    },
  },
  {
    // Configuration files and scripts at root + tests
    files: ["*.ts", "tests/**/*.ts"],
    extends: [ts.configs.disableTypeChecked],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-undef": "off",
    }
  },
  {
    // Disable explicit any warnings for the API router where `as any` is used for structural casting
    files: ["functions/api/routes/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
);
