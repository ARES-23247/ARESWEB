const origin = process.env.HOSTING_EMULATOR_ORIGIN || "http://127.0.0.1:5000";

const missing = await fetch(`${origin}/definitely-missing`);
console.log(`Unknown route status: ${missing.status}`);
if (missing.status !== 404) process.exitCode = 1;

const about = await fetch(`${origin}/about`);
const aboutHtml = await about.text();
console.log(`Static route status: ${about.status}`);
if (about.status !== 200 || !aboutHtml.includes("<title>About Us | ARES 23247</title>")) {
  process.exitCode = 1;
}

const api = await fetch(`${origin}/api/definitely-missing`, {
  headers: { "x-forwarded-for": "127.0.0.1" },
});
console.log(`Unknown API status: ${api.status}`);
if (api.status !== 404) process.exitCode = 1;

const pollen = await fetch(`${origin}/pollen`);
const arcade = await fetch(`${origin}/arcade`);
if (arcade.status !== 200 || !(await arcade.text()).includes("ARES Arcade")) process.exitCode = 1;
console.log(`Arcade route status: ${arcade.status}`);
for (const [path, title] of [
  ["/buzzhex", "BUZZHEX"],
]) {
  const response = await fetch(`${origin}${path}`);
  const html = await response.text();
  if (response.status !== 200 || !html.includes(title)) process.exitCode = 1;
  console.log(`Game route ${path}: ${response.status}`);
}
if (pollen.status !== 200 || !(await pollen.text()).includes("Pollinator Pile-Up")) process.exitCode = 1;
const game = await fetch(`${origin}/games/pollen/index.html`);
const gameCsp = game.headers.get("content-security-policy") || "";
if (game.status !== 200 || game.headers.get("x-frame-options") !== "SAMEORIGIN"
  || !gameCsp.includes("frame-ancestors 'self'") || gameCsp.includes("frame-ancestors 'none'")
  || /script-src[^;]*'unsafe-inline'/.test(gameCsp)) process.exitCode = 1;
console.log(`Pollen route/embedded game status: ${pollen.status}/${game.status}`);
console.log("Embedded game header checks:", {
  sameOrigin: game.headers.get("x-frame-options") === "SAMEORIGIN",
  allowsSelf: gameCsp.includes("frame-ancestors 'self'"),
  deniesFrames: gameCsp.includes("frame-ancestors 'none'"),
  inlineScripts: /script-src[^;]*'unsafe-inline'/.test(gameCsp),
});
