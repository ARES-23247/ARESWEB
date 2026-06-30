export default [
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
    ]
  },
  {
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }]
    }
  }
];
