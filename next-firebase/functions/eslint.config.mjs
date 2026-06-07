import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  globalIgnores([
    "lib/**",
    "node_modules/**",
  ]),
]);

export default eslintConfig;
