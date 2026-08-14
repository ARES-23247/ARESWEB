import { onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import { adminDb } from "./lib/firebase-admin";
import { logger } from "./lib/logger";
import { injectMetadata, metadataForDocument, parseDynamicRoute, renderNotFound } from "./webRendering";
import { RUNTIME_SERVICE_ACCOUNTS } from "./functionConfig";

const SHELL_URL = "https://aresfirst-portal.web.app/dashboard";
const HEALTH_PATH = "/__deployment-health/web";

async function loadShell(): Promise<string> {
  // Always resolve the active Hosting release. Caching a previous release's
  // hashed asset references across a deployment can produce a broken page.
  const response = await fetch(SHELL_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Hosting shell returned HTTP ${response.status}`);
  const html = await response.text();
  if (!html.includes('<div id="root"></div>') || !html.includes("</head>")) {
    throw new Error("Hosting shell is not a valid application document");
  }
  return html;
}

export async function handleWebRequest(req: Request, res: Response): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.status(405).send("Method not allowed");
    return;
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
