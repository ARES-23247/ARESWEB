"use client";

import { Download, ExternalLink, Mail } from "lucide-react";
import SEO from "@/components/SEO";
import { siteConfig } from "@/lib/site-config";

/**
 * Brand and press kit. Every asset referenced here ships with the site
 * repository — nothing is mocked — and the palette/typography values mirror
 * src/styles/ares-design-tokens.css (ContrastTokens.test.ts enforces the
 * token contract).
 */
const BRAND_COLORS: Array<{ name: string; hex: string; role: string; className: string }> = [
  { name: "ARES Red", hex: "#C00000", role: "Primary identity and calls to action", className: "bg-[#c00000]" },
  { name: "ARES Gold", hex: "#FFB81C", role: "Accents, highlights, and recognition", className: "bg-[#ffb81c]" },
  { name: "ARES Cyan", hex: "#00E5FF", role: "Technical accents and focus states", className: "bg-[#00e5ff]" },
  { name: "ARES Bronze", hex: "#CD7F32", role: "Secondary warmth and hover depth", className: "bg-[#cd7f32]" },
  { name: "Obsidian", hex: "#1A1A1A", role: "Foundation background", className: "bg-[#1a1a1a] border border-white/20" },
  { name: "Marble", hex: "#F9F9F9", role: "Primary text on dark surfaces", className: "bg-[#f9f9f9]" },
];

const ASSETS: Array<{ label: string; href: string; note: string }> = [
  { label: "Logo mark (SVG)", href: "/favicon.svg", note: "Vector mark for print and screen" },
  { label: "Logo mark (WebP, 1024px)", href: "/favicon.webp", note: "High-resolution raster" },
  { label: "Logo mark (PNG)", href: "/favicon.png", note: "Legacy raster fallback" },
  { label: "Default social card (JPG)", href: "/social-post-default.jpg", note: "1200x630 share image" },
];

export default function BrandPage() {
  return (
    <div className="flex min-h-screen flex-col bg-obsidian text-marble">
      <SEO
        title="Brand & Press Kit"
        description="Official ARES 23247 brand assets, palette, typography, and boilerplate for media, sponsors, and partners."
      />

      <main className="mx-auto w-full max-w-5xl px-6 py-16">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-ares-gold">
          ARES 23247
        </p>
        <h1 className="mt-3 font-heading text-4xl font-black uppercase text-white md:text-5xl">
          Brand &amp; Press Kit
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-marble/80">
          Everything a journalist, sponsor, or partner needs to represent ARES
          correctly: downloadable assets, the exact palette and typography, and
          approved boilerplate. All assets on this page are the ones this
          website actually ships with.
        </p>

        <section aria-labelledby="brand-assets" className="mt-14">
          <h2 id="brand-assets" className="font-heading text-2xl font-black uppercase text-white">
            Assets
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {ASSETS.map((asset) => (
              <li key={asset.href} className="flex items-center justify-between gap-4 border border-white/10 bg-white/5 p-5">
                <div>
                  <p className="text-sm font-bold text-white">{asset.label}</p>
                  <p className="mt-1 text-xs text-marble/60">{asset.note}</p>
                </div>
                <a
                  href={asset.href}
                  download
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 border border-ares-gold/40 px-4 py-2 text-xs font-black uppercase tracking-wider text-ares-gold focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  <Download size={14} aria-hidden="true" /> Download
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="brand-palette" className="mt-14">
          <h2 id="brand-palette" className="font-heading text-2xl font-black uppercase text-white">
            Palette
          </h2>
          <p className="mt-2 text-sm text-marble/70">
            Values come straight from the site&apos;s design tokens; use them
            unchanged for brand consistency.
          </p>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BRAND_COLORS.map((color) => (
              <li key={color.hex} className="border border-white/10 bg-white/5">
                <div className={`h-16 w-full ${color.className}`} aria-hidden="true" />
                <div className="p-4">
                  <p className="text-sm font-bold text-white">{color.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-ares-gold">{color.hex}</p>
                  <p className="mt-1 text-xs text-marble/60">{color.role}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="brand-type" className="mt-14">
          <h2 id="brand-type" className="font-heading text-2xl font-black uppercase text-white">
            Typography
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="border border-white/10 bg-white/5 p-6">
              <p className="font-heading text-3xl font-black uppercase text-white">League Spartan</p>
              <p className="mt-2 text-xs text-marble/60">
                Display and headings — geometric, bold, and always uppercase for
                section titles.
              </p>
            </div>
            <div className="border border-white/10 bg-white/5 p-6">
              <p className="text-3xl font-semibold text-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
                Inter
              </p>
              <p className="mt-2 text-xs text-marble/60">
                Body copy and interface text, from 300 to 900 weights.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="brand-boilerplate" className="mt-14">
          <h2 id="brand-boilerplate" className="font-heading text-2xl font-black uppercase text-white">
            Boilerplate
          </h2>
          <div className="mt-5 space-y-4 border border-white/10 bg-white/5 p-6 text-sm leading-relaxed text-marble/85">
            <p>
              <strong className="text-white">Short:</strong> ARES 23247 is a
              FIRST® Tech Challenge robotics team from Morgantown, West
              Virginia, where students design, build, and program competition
              robots.
            </p>
            <p>
              <strong className="text-white">Full:</strong> ARES 23247 — the
              Appalachian Robotics &amp; Engineering Society — is a
              student-led FIRST® Tech Challenge team based in Morgantown, West
              Virginia. Students handle engineering, programming, business, and
              outreach while coaches and mentors guide the program. The team
              publishes its seasons, robots, outreach, and finances at{" "}
              <a href="https://aresfirst.org" className="text-ares-cyan underline underline-offset-2">
                aresfirst.org
              </a>
              .
            </p>
          </div>
        </section>

        <section aria-labelledby="brand-usage" className="mt-14">
          <h2 id="brand-usage" className="font-heading text-2xl font-black uppercase text-white">
            Usage
          </h2>
          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-relaxed text-marble/80">
            <li>Keep the mark clear of busy backgrounds; prefer Obsidian or white fields.</li>
            <li>Do not recolor, rotate, or distort the mark; use the palette values as shipped.</li>
            <li>
              Refer to the team as “ARES 23247” on first mention and “ARES”
              afterwards. FIRST® is a registered trademark of FIRST
              (firstinspires.org).
            </li>
            <li>
              For interview, photo, or event inquiries, email{" "}
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="inline-flex items-center gap-1 text-ares-cyan underline underline-offset-2"
              >
                <Mail size={13} aria-hidden="true" /> {siteConfig.contact.email}
              </a>
              .
            </li>
          </ul>
        </section>

        <footer className="mt-16 border-t border-white/10 pt-6 text-xs text-marble/50">
          <p className="inline-flex items-center gap-2">
            <ExternalLink size={13} aria-hidden="true" />
            Design tokens live in the repository at
            src/styles/ares-design-tokens.css; this page always mirrors them.
          </p>
        </footer>
      </main>
    </div>
  );
}
