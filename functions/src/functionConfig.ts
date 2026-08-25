export const allowedOrigins = [
  "https://ares23247.web.app",
  "https://ares23247.firebaseapp.com",
  "https://aresfirst.org",
  "https://aresfirst-portal.web.app",
  "https://aresfirst-portal.firebaseapp.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
] as const;

export const API_ROUTE_GROUPS = {
  public: [
    "/api/app-check", "/api/announcements", "/api/calendar", "/api/content", "/api/sponsors", "/api/outreach", "/api/tournaments",
    "/api/robots", "/api/store", "/api/finance", "/api/reference",
    "/api/og", "/sitemap.xml", "/api/sitemap.xml",
    "/feed.xml", "/api/feed.xml",
  ],
  core: ["/api/inquiries", "/api/profiles", "/api/content-admin"],
  media: ["/api/photos", "/api/ai", "/api/videos"],
  drive: ["/api/drive"],
  communications: ["/api/tasks", "/api/webhooks", "/api/simulations", "/api/zulip"],
} as const;

export const FUNCTION_SECRET_BINDINGS = {
  publicApi: [],
  coreApi: ["ENCRYPTION_SECRET", "PROFILE_SYNC_SECRET", "ZULIP_BOT_EMAIL", "ZULIP_API_KEY"],
  mediaApi: [
    "ENCRYPTION_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
    "GOOGLE_PHOTOS_REFRESH_TOKEN", "GEMINI_API_KEY", "YOUTUBE_API_KEY",
  ],
  driveApi: ["ENCRYPTION_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_DRIVE_REFRESH_TOKEN"],
  communicationsApi: ["GITHUB_PAT", "ZULIP_BOT_EMAIL", "ZULIP_API_KEY", "ZULIP_WEBHOOK_TOKEN", "BLUESKY_APP_PASSWORD", "BUFFER_API_KEY", "ONSHAPE_WEBHOOK_TOKEN"],
} as const;

/**
 * Dedicated production identities keep a compromised function from inheriting
 * the permissions and secrets of an unrelated workload. These accounts are
 * created and granted least-privilege access in Google Cloud before deploy.
 */
export const RUNTIME_SERVICE_ACCOUNTS = {
  publicApi: "aresweb-public-runtime@aresfirst-portal.iam.gserviceaccount.com",
  coreApi: "aresweb-core-runtime@aresfirst-portal.iam.gserviceaccount.com",
  mediaApi: "aresweb-media-runtime@aresfirst-portal.iam.gserviceaccount.com",
  driveApi: "aresweb-drive-runtime@aresfirst-portal.iam.gserviceaccount.com",
  communicationsApi: "aresweb-communications-runtime@aresfirst-portal.iam.gserviceaccount.com",
  cleanupOldInquiries: "aresweb-inquiry-cleanup@aresfirst-portal.iam.gserviceaccount.com",
  syncGoogleDriveChanges: "aresweb-drive-sync@aresfirst-portal.iam.gserviceaccount.com",
  web: "aresweb-web-runtime@aresfirst-portal.iam.gserviceaccount.com",
} as const;
