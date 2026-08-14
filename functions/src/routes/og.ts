import { createHash } from "node:crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import type { SharpConstructor } from "sharp";
import { asyncHandler } from "../lib/utils";

const router = express.Router();
const OG_CACHE_CONTROL = "public, max-age=86400, s-maxage=31536000, immutable";
let sharpFactoryPromise: Promise<SharpConstructor> | null = null;

router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: "Too many social card requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
}));

function loadSharp(): Promise<SharpConstructor> {
  sharpFactoryPromise ??= import("sharp").then((module) => module.default as SharpConstructor);
  return sharpFactoryPromise;
}

function normalizedQueryText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") return fallback;
  const normalized = value
    .replace(/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return normalized || fallback;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxLineLength = 32): string[] {
  if (text.length <= maxLineLength) return [text];

  const firstBreak = text.lastIndexOf(" ", maxLineLength);
  const firstEnd = firstBreak > Math.floor(maxLineLength / 2) ? firstBreak : maxLineLength;
  const firstLine = text.slice(0, firstEnd).trim();
  const remaining = text.slice(firstEnd).trim();
  if (remaining.length <= maxLineLength) return [firstLine, remaining];

  const secondBreak = remaining.lastIndexOf(" ", maxLineLength - 1);
  const secondEnd = secondBreak > Math.floor(maxLineLength / 2) ? secondBreak : maxLineLength - 1;
  return [firstLine, `${remaining.slice(0, secondEnd).trimEnd()}…`];
}

interface SocialCardInput {
  title: string;
  category: string;
  author: string;
  date: string;
  theme: "cyan" | "red" | "gold";
}

function renderSocialCardSvg({ title, category, author, date, theme }: SocialCardInput): string {
  const titleLines = wrapText(title);
  const accentColor = theme === "cyan" ? "#00F0FF" : theme === "red" ? "#E63946" : "#E5A823";
  const secondaryAccent = theme === "cyan" ? "#0088FF" : theme === "red" ? "#B81D24" : "#FFC857";
  const categoryRgb = theme === "cyan" ? "0,240,255" : theme === "red" ? "230,57,70" : "229,168,35";
  const line1 = escapeXml(titleLines[0] || "");
  const line2 = escapeXml(titleLines[1] || "");
  const safeCategory = escapeXml(category);
  const safeAuthor = escapeXml(author);
  const safeDate = escapeXml(date);

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
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

  <rect width="1200" height="630" fill="url(#bgGrad)"/>
  <rect width="1200" height="630" fill="url(#glowTopRight)"/>
  <rect width="1200" height="630" fill="url(#glowBottomLeft)"/>
  <rect x="24" y="24" width="1152" height="582" rx="16" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
  <rect x="24" y="24" width="1152" height="4" fill="url(#accentGrad)"/>

  <g transform="translate(60, 48)" opacity="0.4">
    <path d="M0,0 H16 V12 H8 V4 H12 V8 H4 V0 M20,0 H36 V12 H28 V4 H32 V8 H24 V0 M40,0 H56 V12 H48 V4 H52 V8 H44 V0 M60,0 H76 V12 H68 V4 H72 V8 H64 V0 M80,0 H96 V12 H88 V4 H92 V8 H84 V0" fill="none" stroke="${accentColor}" stroke-width="2"/>
  </g>

  <g transform="translate(60, 80)">
    <rect x="0" y="0" width="220" height="36" rx="18" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    <circle cx="18" cy="18" r="6" fill="${accentColor}"/>
    <text x="36" y="23" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" letter-spacing="1.5">ARES 23247 • FTC</text>
  </g>

  ${safeCategory ? `<g transform="translate(295, 80)">
    <rect x="0" y="0" width="${Math.min(category.length * 9 + 32, 310)}" height="36" rx="18" fill="rgba(${categoryRgb},0.12)" stroke="${accentColor}" stroke-width="1"/>
    <text x="16" y="23" fill="${accentColor}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" letter-spacing="1">${safeCategory.toUpperCase()}</text>
  </g>` : ""}

  <g transform="translate(60, 240)">
    <text x="0" y="0" fill="url(#textGrad)" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="900" letter-spacing="-0.5">${line1}</text>
    ${line2 ? `<text x="0" y="70" fill="url(#textGrad)" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="900" letter-spacing="-0.5">${line2}</text>` : ""}
  </g>

  <line x1="60" y1="460" x2="1140" y2="460" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
  <g transform="translate(60, 520)">
    <text x="0" y="0" fill="#94A3B8" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600">By <tspan fill="#FFFFFF">${safeAuthor}</tspan>${safeDate ? ` • <tspan fill="#94A3B8">${safeDate}</tspan>` : ""}</text>
    <text x="0" y="26" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="500">Appalachian Robotics &amp; Engineering Society • Morgantown, WV</text>
    <g transform="translate(930, -15)">
      <rect x="0" y="0" width="150" height="42" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
      <text x="75" y="26" text-anchor="middle" fill="${accentColor}" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" letter-spacing="0.5">aresfirst.org</text>
    </g>
  </g>
</svg>`;
}

router.get("/", asyncHandler(async (req, res) => {
  const title = normalizedQueryText(req.query.title, "ARES 23247 Robotics", 100);
  const category = normalizedQueryText(req.query.category, "", 30);
  const author = normalizedQueryText(req.query.author, "ARES 23247", 40);
  const date = normalizedQueryText(req.query.date, "", 30);
  const requestedTheme = typeof req.query.theme === "string" ? req.query.theme.toLowerCase() : "";
  const theme: SocialCardInput["theme"] = requestedTheme === "cyan" || requestedTheme === "red"
    ? requestedTheme
    : "gold";
  const input = { title, category, author, date, theme };
  const etag = `"${createHash("sha256").update(JSON.stringify(input)).digest("base64url")}"`;

  res.set({
    "Content-Type": "image/png",
    "Cache-Control": OG_CACHE_CONTROL,
    "ETag": etag,
    "X-Content-Type-Options": "nosniff",
  });
  if (req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return;
  }

  const sharp = await loadSharp();
  const png = await sharp(Buffer.from(renderSocialCardSvg(input)))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  res.send(png);
}));

export default router;
