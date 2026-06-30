export default [
  {
    ignores: [
      "lib/**",
      "node_modules/**",
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
