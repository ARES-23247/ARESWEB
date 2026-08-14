import express from "express";
import { asyncHandler } from "../lib/utils";
import rateLimit from "express-rate-limit";

const router = express.Router();

router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: "Too many social card requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
}));

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxLineLength = 32): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxLineLength) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length >= 2) break;
    }
  }
  if (currentLine && lines.length < 2) {
    lines.push(currentLine);
  }
  if (words.length > 0 && lines.length === 2 && (currentLine !== words[words.length - 1] || text.length > 65)) {
    lines[1] = lines[1].replace(/(\.\.\.)?$/, "...");
  }
  return lines.length > 0 ? lines : ["ARES 23247"];
}

router.get("/", asyncHandler(async (req, res) => {
  const rawTitle = typeof req.query.title === "string" ? req.query.title.trim().slice(0, 100) : "ARES 23247 Robotics";
  const rawCategory = typeof req.query.category === "string" ? req.query.category.trim().slice(0, 30) : "";
  const rawAuthor = typeof req.query.author === "string" ? req.query.author.trim().slice(0, 40) : "ARES 23247";
  const rawDate = typeof req.query.date === "string" ? req.query.date.trim().slice(0, 30) : "";
  const theme = typeof req.query.theme === "string" && ["cyan", "red", "gold"].includes(req.query.theme.toLowerCase())
    ? req.query.theme.toLowerCase()
    : "gold";

  const titleLines = wrapText(rawTitle || "ARES 23247 Robotics");
  const title = escapeXml(rawTitle);
  const category = escapeXml(rawCategory);
  const author = escapeXml(rawAuthor);
  const date = escapeXml(rawDate);

  const accentColor = theme === "cyan" ? "#00F0FF" : theme === "red" ? "#E63946" : "#E5A823";
  const secondaryAccent = theme === "cyan" ? "#0088FF" : theme === "red" ? "#B81D24" : "#FFC857";

  const line1 = escapeXml(titleLines[0] || "");
  const line2 = escapeXml(titleLines[1] || "");

  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B0B0E"/>
      <stop offset="50%" stop-color="#121217"/>
      <stop offset="100%" stop-color="#08080A"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accentColor}"/>
      <stop offset="100%" stop-color="${secondaryAccent}"/>
    </linearGradient>
    <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </linearGradient>
    <radialGradient id="glowTopRight" cx="90%" cy="10%" r="50%">
      <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${accentColor}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowBottomLeft" cx="10%" cy="90%" r="40%">
      <stop offset="0%" stop-color="${secondaryAccent}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${secondaryAccent}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGrad)"/>
  <rect width="1200" height="630" fill="url(#glowTopRight)"/>
  <rect width="1200" height="630" fill="url(#glowBottomLeft)"/>

  <!-- Border Frame -->
  <rect x="24" y="24" width="1152" height="582" rx="16" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
  <rect x="24" y="24" width="1152" height="4" fill="url(#accentGrad)"/>

  <!-- Greek Key Pattern Header Bar -->
  <g transform="translate(60, 48)" opacity="0.4">
    <path d="M0,0 H16 V12 H8 V4 H12 V8 H4 V0 M20,0 H36 V12 H28 V4 H32 V8 H24 V0 M40,0 H56 V12 H48 V4 H52 V8 H44 V0 M60,0 H76 V12 H68 V4 H72 V8 H64 V0 M80,0 H96 V12 H88 V4 H92 V8 H84 V0" fill="none" stroke="${accentColor}" stroke-width="2"/>
  </g>

  <!-- Team Header Badge -->
  <g transform="translate(60, 80)">
    <rect x="0" y="0" width="220" height="36" rx="18" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    <circle cx="18" cy="18" r="6" fill="${accentColor}"/>
    <text x="36" y="23" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" letter-spacing="1.5">ARES 23247 • FTC</text>
  </g>

  ${category ? `
  <!-- Category Pill -->
  <g transform="translate(295, 80)">
    <rect x="0" y="0" width="${category.length * 9 + 32}" height="36" rx="18" fill="rgba(${theme === "cyan" ? "0,240,255" : "229,168,35"},0.12)" stroke="${accentColor}" stroke-width="1"/>
    <text x="16" y="23" fill="${accentColor}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" letter-spacing="1">${category.toUpperCase()}</text>
  </g>
  ` : ""}

  <!-- Article Title -->
  <g transform="translate(60, 240)">
    <text x="0" y="0" fill="url(#textGrad)" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="900" letter-spacing="-0.5">${line1}</text>
    ${line2 ? `<text x="0" y="70" fill="url(#textGrad)" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="900" letter-spacing="-0.5">${line2}</text>` : ""}
  </g>

  <!-- Divider Line -->
  <line x1="60" y1="460" x2="1140" y2="460" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>

  <!-- Footer Metadata -->
  <g transform="translate(60, 520)">
    <!-- Author / Team Info -->
    <text x="0" y="0" fill="#94A3B8" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600">By <tspan fill="#FFFFFF">${author}</tspan>${date ? ` • <tspan fill="#94A3B8">${date}</tspan>` : ""}</text>
    <text x="0" y="26" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="500">Appalachian Robotics &amp; Engineering Society • Morgantown, WV</text>

    <!-- Website Badge (Right) -->
    <g transform="translate(930, -15)">
      <rect x="0" y="0" width="150" height="42" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
      <text x="75" y="26" text-anchor="middle" fill="${accentColor}" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" letter-spacing="0.5">aresfirst.org</text>
    </g>
  </g>
</svg>`;

  const etag = `"${Buffer.from(title + category + author + date + theme).toString("base64url").slice(0, 32)}"`;
  if (req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return;
  }

  res.set({
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
    "ETag": etag,
    "X-Content-Type-Options": "nosniff",
  });

  res.send(svg);
}));

export default router;
