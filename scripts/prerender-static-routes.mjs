import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = join(projectRoot, "dist");
const outputDirectory = join(distDirectory, "prerender");
const baseUrl = "https://aresfirst.org";
const defaultImage = `${baseUrl}/favicon.webp`;

export const staticPageMetadata = [
  ["/", "Home", "ARES 23247 is a FIRST® Tech Challenge robotics team in Morgantown, West Virginia."],
  ["/about", "About Us", "Meet the students, coaches, mentors, and alumni of ARES 23247 and learn about our robotics mission."],
  ["/accessibility", "Accessibility & Web Standards", "Read the ARES 23247 accessibility commitment and supported ways to report a barrier."],
  ["/academy", "ARES Academy", "Explore ARES Academy robotics, mathematics, physics, and engineering lessons."],
  ["/blog", "Blog", "Read technical updates, design notes, code breakdowns, and outreach reflections from ARES 23247."],
  ["/calendar", "Team Calendar", "See published ARES 23247 practices, competitions, outreach programs, and team events."],
  ["/developer-api", "API Reference", "A limited reference for supported ARESWEB public endpoints.", true],
  ["/docs", "ARESLib Documentation", "Read ARESLib documentation, control-loop guides, and robotics API references."],
  ["/finance", "Financial Transparency Ledger", "Review public financial accountability information for ARES 23247."],
  ["/gallery", "Photo Gallery", "Browse published ARES 23247 build, competition, and outreach photos."],
  ["/join", "Join the Team", "Apply to join ARES 23247 as a student member, mentor, or volunteer."],
  ["/leaderboard", "Team Recognition", "Learn how ARES 23247 recognizes teamwork, community impact, and growth."],
  ["/location-morgantown", "Robotics in Morgantown, West Virginia", "Meet ARES 23247, a FIRST® Tech Challenge team based in Morgantown, West Virginia."],
  ["/outreach", "Community Outreach", "Discover ARES 23247 community STEM programs, impact reports, and robot demonstrations."],
  ["/privacy", "Privacy Policy", "Read how ARES 23247 protects visitor, applicant, and team-member information."],
  ["/robots", "Our Robots", "Explore competition robots engineered by ARES 23247 for the FIRST® Tech Challenge."],
  ["/seasons", "Team Legacy", "Explore the competition seasons, achievements, awards, and growth of ARES 23247."],
  ["/sponsors", "Our Sponsors", "Meet the organizations supporting ARES 23247 youth robotics and STEM education."],
  ["/store", "Team Store", "Official ARES 23247 merchandise and team fundraising information."],
  ["/tech-stack", "Technical Stack & Cloud Architecture", "Explore the technology and cloud architecture behind the ARES 23247 team portal."],
  ["/terms", "Terms of Service", "Read the ARES 23247 website terms of service and acceptable-use policies."],
  ["/videos", "Video Hub", "Watch ARES 23247 match recordings, robot reveals, team highlights, and learning guides."],
  ["/tournaments/scouting/entry", "Match Scouting Entry", "Interactive FTC match scouting entry sheet with scoring counters and offline synchronization.", false],
];

function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function outputName(route) {
  return route === "/" ? "home.html" : `${route.slice(1).replaceAll("/", "-")}.html`;
}

export function renderStaticShell(shell, [route, pageTitle, description, noindex = false]) {
  const title = pageTitle === "Home"
    ? "ARES 23247 | Morgantown Robotics Team"
    : `${pageTitle} | ARES 23247`;
  const canonical = `${baseUrl}${route}`;
  let html = shell
    .replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}">`)
    .replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}">`);
  const tags = [
    `<link rel="canonical" href="${canonical}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${defaultImage}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    noindex ? `<meta name="robots" content="noindex, nofollow">` : "",
  ].filter(Boolean).join("\n    ");
  return html.replace("</head>", `    ${tags}\n  </head>`);
}

export function prerenderStaticRoutes() {
  const shell = readFileSync(join(distDirectory, "index.html"), "utf8");
  mkdirSync(outputDirectory, { recursive: true });
  for (const metadata of staticPageMetadata) {
    writeFileSync(join(outputDirectory, outputName(metadata[0])), renderStaticShell(shell, metadata), "utf8");
  }
  writeFileSync(
    join(distDirectory, "404.html"),
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Page Not Found | ARES 23247</title></head><body><main><h1>404 — Page not found</h1><p>This ARES 23247 page does not exist.</p><p><a href="/">Return home</a></p></main></body></html>',
    "utf8",
  );
  console.log(`Prerendered ${staticPageMetadata.length} public route shells.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  prerenderStaticRoutes();
}
