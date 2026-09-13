import {defineConfig,devices} from "@playwright/test";
export default defineConfig({
  testDir:"./e2e",testMatch:"biobuzzSimulator.spec.ts",timeout:60000,workers:1,
  reporter:"list",use:{baseURL:"http://127.0.0.1:3029",serviceWorkers:"block",screenshot:"only-on-failure"},
  projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}}],
  webServer:{command:"node node_modules/vite/bin/vite.js build --mode e2e --outDir scratch/biobuzz/e2e-dist && node node_modules/vite/bin/vite.js preview --outDir scratch/biobuzz/e2e-dist --host 127.0.0.1 --port 3029 --strictPort",url:"http://127.0.0.1:3029",timeout:120000,reuseExistingServer:false},
});
