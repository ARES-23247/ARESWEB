export const siteConfig = {
  team: {
    number: "23247",
    name: "ARES",
    fullName: "ARES 23247",
    orgName: "ARES Robotics",
    description: "Empowering the next generation of engineers and leaders.",
  },
  urls: {
    base: "https://aresfirst.org",
    githubOrg: "ARES-23247",
    zulip: "https://ares.zulipchat.com",
    bluesky: "ares23247.bsky.social",
    tiktok: "ares.robotics.23247"
  },
  contact: {
    email: "contact@aresfirst.org",
    dashboardEmail: "dashboard@aresfirst.org",
    sponsorship: "sponsors@aresfirst.org"
  },
  // Cloudflare Turnstile — public site key (safe to commit)
  // Get yours at: https://dash.cloudflare.com/?to=/:account/turnstile
  // Use "1x00000000000000000000AA" for testing (always passes)
  turnstile: {
    siteKey: "0x4AAAAAADArWmWO1VgHsJWY",
  }
};
