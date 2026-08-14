import { createApiApp } from "../apiApp";
import calendarRouter from "../routes/calendar";
import financeRouter from "../routes/finance";
import outreachRouter from "../routes/outreach";
import referenceRouter from "../routes/reference";
import robotsRouter from "../routes/robots";
import sitemapRouter from "../routes/sitemap";
import sponsorsRouter from "../routes/sponsors";
import storeRouter from "../routes/store";
import tournamentsRouter from "../routes/tournaments";
import ogRouter from "../routes/og";
import announcementsRouter from "../routes/announcements";

export const publicApp = createApiApp({ routes: [
  { path: "/api/announcements", router: announcementsRouter },
  { path: "/api/calendar", router: calendarRouter },
  { path: "/api/sponsors", router: sponsorsRouter },
  { path: "/api/outreach", router: outreachRouter },
  { path: "/api/tournaments", router: tournamentsRouter },
  { path: "/api/robots", router: robotsRouter },
  { path: "/api/store", router: storeRouter },
  { path: "/api/finance", router: financeRouter },
  { path: "/api/reference", router: referenceRouter },
  { path: "/api/og", router: ogRouter },
  { path: "/sitemap.xml", router: sitemapRouter },
  { path: "/api/sitemap.xml", router: sitemapRouter },
] });
