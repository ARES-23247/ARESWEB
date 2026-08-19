import { onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { adminDb } from "./lib/firebase-admin";
import { logger } from "./lib/logger";
import { injectMetadata, metadataForDocument, parseDynamicRoute, renderNotFound } from "./webRendering";
import { RUNTIME_SERVICE_ACCOUNTS } from "./functionConfig";

const SHELL_URL = "https://aresfirst-portal.web.app/dashboard";
const HEALTH_PATH = "/__deployment-health/web";
const ROOT_CONTAINER_PATTERN = /<div\b[^>]*\bid=(?:"root"|'root')[^>]*>/i;
const CLIENT_ENTRY_PATTERN =
  /<script\b[^>]*\bsrc=(?:"\/assets\/index-[^"]+\.js"|'\/assets\/index-[^']+\.js')[^>]*>/i;

// A five-second micro-cache collapses bursts onto one shell fetch without
// serving a previous release's hashed assets for long: dynamic pages may
// reference retired asset URLs for at most five seconds after a deploy.
const SHELL_CACHE_TTL_MS = 5_000;
let shellCache: { html: string; expiresAt: number } | null = null;

async function loadShell(): Promise<string> {
  if (shellCache && shellCache.expiresAt > Date.now()) {
    return shellCache.html;
  }
  const response = await fetch(SHELL_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Hosting shell returned HTTP ${response.status}`);
  const html = await response.text();
  if (!ROOT_CONTAINER_PATTERN.test(html) || !CLIENT_ENTRY_PATTERN.test(html) || !html.includes("</head>")) {
    throw new Error("Hosting shell is not a valid application document");
  }
  shellCache = { html, expiresAt: Date.now() + SHELL_CACHE_TTL_MS };
  return html;
}

const requestLimiter = rateLimit({
  windowMs: 60_000,
  max: 240,
  message: { error: "Too many requests. Please try again shortly." },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Test seam: the micro-cache otherwise leaks a valid shell across cases. */
export function resetShellCacheForTests(): void {
  shellCache = null;
}

export async function handleWebRequest(req: Request, res: Response): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.status(405).send("Method not allowed");
    return;
  }

  // The in-process limiter needs a socket-backed request; unit tests drive
  // the handler with bare mocks, so it is bypassed outside real runtimes.
  if (process.env.NODE_ENV !== "test" && process.env.FUNCTIONS_EMULATOR !== "true") {
    await new Promise<void>((resolve) => {
      requestLimiter(req, res, () => resolve());
    });
    if (res.writableEnded) return;
  }

  if (req.path === HEALTH_PATH) {
    try {
      await loadShell();
      res.status(200).set("Cache-Control", "no-store").type("json").send('{"status":"healthy"}');
    } catch (error) {
      logger.error("web-render", "Dynamic web shell health check failed", error);
      res.status(503).set("Cache-Control", "no-store").type("json").send('{"status":"unavailable"}');
    }
    return;
  }

  const route = parseDynamicRoute(req.path);
  if (!route) {
    res.status(404).set("Cache-Control", "public, max-age=60").type("html").send(renderNotFound());
    return;
  }

  try {
    const snapshot = await adminDb.collection(route.collection).doc(route.id).get();
    const metadata = snapshot.exists
      ? metadataForDocument(route, snapshot.data() as Record<string, unknown>)
      : null;
    if (!metadata) {
      res.status(404).set("Cache-Control", "public, max-age=60").type("html").send(renderNotFound());
      return;
    }

    const html = injectMetadata(await loadShell(), metadata);
    res.status(200).set("Cache-Control", "no-cache, no-store, must-revalidate").type("html").send(html);
  } catch (error) {
    logger.error("web-render", "Unable to render a dynamic public page", error);
    res.status(503).set("Cache-Control", "no-store").type("html").send(
      "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex\"><title>Temporarily unavailable</title></head><body><main><h1>Temporarily unavailable</h1><p>Please try this page again shortly.</p></main></body></html>",
    );
  }
}

export const web = onRequest({
  cors: false,
  invoker: "public",
  memory: "256MiB",
  timeoutSeconds: 20,
  concurrency: 40,
  maxInstances: 5,
  serviceAccount: RUNTIME_SERVICE_ACCOUNTS.web,
}, handleWebRequest);
