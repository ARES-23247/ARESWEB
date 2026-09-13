import {defineConfig,devices} from "@playwright/test";
export default defineConfig({testDir:"./tests/browser",testMatch:"biobuzz-online.spec.ts",workers:1,timeout:230000,reporter:"list",use:{baseURL:"http://127.0.0.1:3032",serviceWorkers:"block",...devices["Desktop Chrome"]}});
