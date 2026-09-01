import { copyFile } from "node:fs/promises";

await Promise.all([
  copyFile("e2e/fixtures/legacy-pwa.html", "dist/legacy-pwa.html"),
  copyFile("e2e/fixtures/legacy-sw.js", "dist/legacy-sw.js"),
]);
