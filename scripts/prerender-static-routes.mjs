import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = join(projectRoot, "dist");
const outputDirectory = join(distDirectory, "prerender");
const baseUrl = "https://aresfirst.org";

/**
 * Prerendered route metadata.
 *
 * [route, pageTitle, metaDescription, noindex?, sections?]
 *
 * `sections` provides the crawlable body for the shell. Every non-home route
 * MUST carry sections: Google Search Console classified the previous shells —
 * which all reused the homepage fallback body — as soft 404s and duplicate
 * content, so each shell now serves route-unique headings, copy, and internal
 * links. React replaces this markup after hydration; it exists for crawlers
 * and no-JS visitors.
 */
export const staticPageMetadata = [
  ["/", "Home", "ARES 23247 is a FIRST® Tech Challenge robotics team in Morgantown, West Virginia."],
  ["/about", "About Us", "Meet the students, coaches, mentors, and alumni of ARES 23247 and learn about our robotics mission.", false, [
    ["Who we are", "ARES 23247 is the Appalachian Robotics & Engineering Society, a student-led FIRST® Tech Challenge team from Morgantown, West Virginia. Students design, build, and program competition robots while coaches and mentors guide engineering, business, and outreach work. <a href=\"/seasons\">See our seasons and legacy</a> or <a href=\"/join\">apply to join</a>."],
    ["What we value", "The team emphasizes gracious professionalism, hands-on engineering, and community impact. Explore our <a href=\"/outreach\">outreach programs</a> or meet <a href=\"/robots\">the robots we have built</a>."],
  ]],
  ["/brand", "Brand & Press Kit", "Official ARES 23247 logo assets, brand palette, typography, and media boilerplate.", false, [
    ["Assets and identity", "Download the official ARES 23247 logo assets and default social card, read the exact palette and typography used across this site, and use the approved boilerplate for press and sponsor materials. <a href=\"/about\">Learn about the team</a> or <a href=\"/sponsors\">become a sponsor</a>."],
  ]],
  ["/buzzello", "BUZZELLO™", "Play BUZZELLO, ARES 23247's hexagonal strategy game, locally or against the computer.", false, [
    ["Hexagonal strategy", "Play BUZZELLO on a 61-cell hexagonal board. Challenge another player on the same device or choose from three computer difficulty levels, with keyboard controls, move history, and undo support."],
  ]],
  ["/buzzle", "BUZZLE™", "Play BUZZLE, ARES 23247's three-axis hexagonal word game.", false, [
    ["Three-axis word strategy", "Build connected words on a 127-cell hexagonal board. BUZZLE supports two to four local players, letter and word multipliers, blank tiles, exchanges, keyboard controls, and cross-words on all three axes."],
  ]],
  ["/accessibility", "Accessibility & Web Standards", "Read the ARES 23247 accessibility commitment and supported ways to report a barrier.", false, [
    ["Our commitment", "ARES 23247 works to keep this website usable with keyboards, screen readers, and mobile devices. This page explains the standards we target, the assistive technologies we test with, and how to contact the team if you encounter a barrier."],
  ]],
  ["/academy", "ARES Academy", "Explore ARES Academy robotics, mathematics, physics, and engineering lessons.", false, [
    ["Learn with ARES Academy", "ARES Academy is the team's library of interactive lessons and simulations covering robotics mechanisms, mathematics, physics, and programming. Lessons pair explanations with runnable examples built by students. Start with the <a href=\"/academy\">lesson catalog</a> or watch walkthroughs in the <a href=\"/videos\">video hub</a>."],
  ]],
  ["/blog", "Blog", "Read technical updates, design notes, code breakdowns, and outreach reflections from ARES 23247.", false, [
    ["Engineering notes from the team", "Students and mentors publish build updates, CAD and code breakdowns, competition retrospectives, and outreach reflections. Posts are written by the students who did the work. Subscribe via RSS or browse the <a href=\"/blog\">latest posts</a>; longer references live in the <a href=\"/docs\">ARESLib documentation</a>."],
  ]],
  ["/calendar", "Team Calendar", "See published ARES 23247 practices, competitions, outreach programs, and team events.", false, [
    ["Upcoming team events", "The team calendar lists practices, competition dates, outreach demonstrations, and community events open to visitors. Each entry shows location and timing details where they are public. To invite ARES to an event, reach out through the <a href=\"/join\">contact and join page</a>."],
  ]],
  ["/developer-api", "API Reference", "A limited reference for supported ARESWEB public endpoints.", true, [
    ["Public API reference", "Reference documentation for the supported public ARESWEB API endpoints, including response shapes and rate limits. These endpoints are intended for team tooling and integrations."],
  ]],
  ["/docs", "ARESLib Documentation", "Read ARESLib documentation, control-loop guides, and robotics API references.", false, [
    ["ARESLib documentation", "ARESLib is the team's robotics software library. These guides cover its control loops, hardware abstractions, and robotics APIs with worked examples from our competition code. For broader lessons, visit <a href=\"/academy\">ARES Academy</a>."],
  ]],
  ["/finance", "Financial Transparency Ledger", "Review public financial accountability information for ARES 23247.", false, [
    ["Public finance records", "As a community youth robotics team, ARES 23247 publishes a categorized record of income and expenses so families and sponsors can see how funds support students. Browse the <a href=\"/finance\">public ledger</a> or learn about <a href=\"/sponsors\">sponsorship</a>."],
  ]],
  ["/gallery", "Photo Gallery", "Browse published ARES 23247 build, competition, and outreach photos.", false, [
    ["Team photos", "A curated gallery of published photographs from build seasons, competitions, and community outreach. For match footage and reveal videos, visit the <a href=\"/videos\">video hub</a>."],
  ]],
  ["/join", "Join the Team", "Apply to join ARES 23247 as a student member, mentor, or volunteer.", false, [
    ["Join ARES 23247", "Students in grades 7–12 in and around Morgantown, West Virginia can apply to join the team — no robotics experience required. Adults can support the team as technical mentors, business mentors, or volunteers. <a href=\"/join\">Start your application</a> or read about <a href=\"/robotics-west-virginia\">robotics opportunities across West Virginia</a>."],
  ]],
  ["/leaderboard", "Team Recognition", "Learn how ARES 23247 recognizes teamwork, community impact, and growth.", false, [
    ["Team recognition", "ARES 23247 celebrates members for teamwork, community impact, technical growth, and leadership throughout the season. This page explains the recognition categories and how recipients are chosen. See the results in our <a href=\"/seasons\">season history</a>."],
  ]],
  ["/location-morgantown", "Robotics in Morgantown, West Virginia", "Meet ARES 23247, a FIRST® Tech Challenge team based in Morgantown, West Virginia.", false, [
    ["Robotics in Morgantown", "ARES 23247 trains in Morgantown, West Virginia and welcomes students from surrounding North Central West Virginia communities. The team competes in FIRST® Tech Challenge events across the region. <a href=\"/join\">Check joining details</a> or explore <a href=\"/robotics-west-virginia\">robotics across West Virginia</a>."],
    ["More robotics in Morgantown", "Morgantown is home to a growing robotics community. MARS — <a href=\"https://www.marsfirst.org/\">FIRST Robotics Competition Team 2614</a> at WVU — fields a high-school FRC team and mentors local FIRST LEGO League teams each fall. The <a href=\"https://www.wvrobot.org/\">West Virginia Robotics Alliance</a>, partnered with NASA's IV&V facility in Fairmont, runs REC Foundation programs statewide: the Aerial Drone Competition (the Dragonfly regional championship at Fairmont State University) and the V5 and VIQ Robotics Competitions formerly known as VEX. <a href=\"https://www.firstinspires.org/robotics/fll\">FIRST LEGO League</a> gives elementary and middle school students a research-and-build first step into robotics."],
  ]],
  ["/outreach", "Community Outreach", "Discover ARES 23247 community STEM programs, impact reports, and robot demonstrations.", false, [
    ["STEM outreach in our community", "The team brings robots to schools, libraries, and community events across the region to inspire younger students. Read about our programs and their measured impact, or look through the <a href=\"/gallery\">photo gallery</a> to see outreach in action."],
  ]],
  ["/privacy", "Privacy Policy", "Read how ARES 23247 protects visitor, applicant, and team-member information.", false, [
    ["Privacy policy", "How ARES 23247 collects, uses, protects, and deletes information from visitors, joining applicants, and team members — including protections for student data."],
  ]],
  ["/robotics-west-virginia", "Robotics in West Virginia", "A guide to robotics in West Virginia from ARES 23247 — FIRST programs, finding a team, and starting a new WV robotics team.", false, [
    ["Robotics in West Virginia", "A guide from ARES 23247 to robotics opportunities across the Mountain State: FIRST program levels for every age, how to find a team near you, and how to start a new team in your community. <a href=\"/join\">Join us in Morgantown</a> or <a href=\"/location-morgantown\">learn about our hometown</a>."],
  ]],
  ["/robots", "Our Robots", "Explore competition robots engineered by ARES 23247 for the FIRST® Tech Challenge.", false, [
    ["The ARES robot fleet", "Every season ARES 23247 designs, builds, and programs a new competition robot for the FIRST® Tech Challenge game. Browse robot specifications, design decisions, and reveal videos from current and past machines. Design notes continue in the <a href=\"/blog\">team blog</a>."],
  ]],
  ["/seasons", "Team Legacy", "Explore the competition seasons, achievements, awards, and growth of ARES 23247.", false, [
    ["Seasons and legacy", "Season-by-season records of ARES 23247: the games we played, the robots we built, awards and placements, and how the team grew. Start with our <a href=\"/robots\">robot fleet</a> or see who made it possible on the <a href=\"/about\">about page</a>."],
  ]],
  ["/sponsors", "Our Sponsors", "Meet the organizations supporting ARES 23247 youth robotics and STEM education.", false, [
    ["Sponsors and partners", "ARES 23247 is powered by organizations and families who fund parts, tools, registration, and travel for student engineers. Meet our current sponsors and learn how sponsorship supports West Virginia STEM education. Support details are also in the <a href=\"/finance\">public finance ledger</a>."],
  ]],
  ["/store", "Team Store", "Official ARES 23247 merchandise and team fundraising information.", false, [
    ["Team merchandise", "Official ARES 23247 merchandise. Purchases directly support the team's parts, tools, and competition travel — see the <a href=\"/finance\">finance ledger</a> for how funds are used."],
  ]],
  ["/tech-stack", "Technical Stack & Cloud Architecture", "Explore the technology and cloud architecture behind the ARES 23247 team portal.", false, [
    ["How this site is built", "This portal is a Vite + React application on Firebase Hosting with Cloud Functions, Firestore, and Storage — with security, accessibility, and testing gates in CI. This page documents the stack and the engineering practices behind it. Student projects like <a href=\"/academy\">ARES Academy</a> are built on the same principles."],
  ]],
  ["/terms", "Terms of Service", "Read the ARES 23247 website terms of service and acceptable-use policies.", false, [
    ["Terms of service", "The terms governing use of the ARES 23247 website, including acceptable use, content ownership, and contact information."],
  ]],
  ["/tournaments", "Tournaments", "Follow ARES 23247 competition events, match schedules, and tournament results.", false, [
    ["Competition events", "Track ARES 23247 at FIRST® Tech Challenge tournaments: event schedules, match results, and scouting data gathered by the team. Event dates also appear on the <a href=\"/calendar\">team calendar</a>."],
  ]],
  ["/videos", "Video Hub", "Watch ARES 23247 match recordings, robot reveals, team highlights, and learning guides.", false, [
    ["Team videos", "Match recordings, robot reveals, season highlights, and technical walkthroughs from ARES 23247. For step-by-step lessons, visit <a href=\"/academy\">ARES Academy</a>."],
  ]],
];

function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function outputName(route) {
  return route === "/" ? "home.html" : `${route.slice(1).replaceAll("/", "-")}.html`;
}

/** Build the crawlable body for a non-home route shell. */
function renderRouteBody(pageTitle, description, sections) {
  const parts = [`<h1>${escapeHtml(pageTitle)}</h1>`, `<p>${escapeHtml(description)}</p>`];
  for (const [heading, html] of sections ?? []) {
    parts.push(`<h2>${escapeHtml(heading)}</h2>`);
    parts.push(`<p>${html}</p>`);
  }
  parts.push('<p><a href="/">ARES 23247 — West Virginia robotics team</a></p>');
  return `<main>\n        ${parts.join("\n        ")}\n      </main>`;
}

/** Replace the app fallback inside <div id="root"> with route-unique content.
 *  The bundled entry script is injected into <head> (its position varies by
 *  build), so anchor on #root and the final </div> of the document instead. */
function replaceRootContents(shell, innerHtml) {
  const rootStart = shell.indexOf('<div id="root">');
  const bodyEnd = shell.lastIndexOf("</body>");
  if (rootStart === -1 || bodyEnd === -1) {
    throw new Error("Prerender shell is missing the #root container or body.");
  }
  const rootClose = shell.lastIndexOf("</div>", bodyEnd);
  if (rootClose < rootStart) {
    throw new Error("Prerender shell #root container is never closed.");
  }
  return `${shell.slice(0, rootStart)}<div id="root">\n      ${innerHtml}\n    ${shell.slice(rootClose)}`;
}

export function renderStaticShell(shell, [route, pageTitle, description, noindex = false, sections]) {
  const title = pageTitle === "Home"
    ? "ARES 23247 | West Virginia Robotics Team (Morgantown, WV)"
    : `${pageTitle} | ARES 23247`;
  const canonical = `${baseUrl}${route}`;
  // Branded 1200x630 card from the CDN-cached OG renderer (keyed by title),
  // replacing the old favicon fallback.
  const ogImage = `${baseUrl}/api/og?title=${encodeURIComponent(title)}`;
  let html = shell
    .replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}">`)
    .replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}">`)
    // The Vite source shell carries the homepage canonical as its fallback;
    // every prerendered route must REPLACE it, never duplicate it.
    .replace(/<link\s+rel=["']canonical["'][^>]*>/i, "");
  // The home shell keeps the rich homepage fallback body; every other route
  // swaps in unique crawlable content so shells are not duplicates of "/".
  if (route !== "/") {
    if (!sections?.length) {
      throw new Error(`Prerender route ${route} must define body sections.`);
    }
    html = replaceRootContents(html, renderRouteBody(pageTitle, description, sections));
  }
  const tags = [
    `<link rel="canonical" href="${canonical}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${ogImage}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${escapeHtml(title)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${ogImage}">`,
    // Keep in sync with ORGANIZATION_SCHEMA in src/components/SEO.tsx; the
    // static copy serves crawlers and platforms that never execute the SPA.
    `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "ARES 23247",
      url: baseUrl,
      logo: `${baseUrl}/favicon.webp`,
      description: "ARES 23247 is a FIRST Tech Challenge robotics team based in Morgantown, West Virginia.",
    })}</script>`,
    noindex ? `<meta name="robots" content="noindex, nofollow">` : "",
  ].filter(Boolean).join("\n    ");
  const rendered = html.replace("</head>", `    ${tags}\n  </head>`);
  // A second canonical (for example from a future index.html edit) would let
  // Google consolidate every route onto "/" — fail the build instead.
  const canonicalCount = rendered.match(/<link\s+rel=["']canonical["']/gi)?.length ?? 0;
  if (canonicalCount !== 1) {
    throw new Error(`Prerender route ${route} emitted ${canonicalCount} canonical tags.`);
  }
  return rendered;
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
