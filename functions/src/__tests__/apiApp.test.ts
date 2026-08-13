import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiApp } from "../apiApp";

const router = express.Router();
router.get("/", (_req, res) => res.json({ ok: true }));

const app = createApiApp({
  routes: [{ path: "/api/example", router }],
  enableLargePhotoUpload: true,
});

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

describe("isolated API app factory", () => {
  beforeAll(async () => {
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it("serves a mounted route and allows same-project production origins", async () => {
    const response = await fetch(`${baseUrl}/api/example`, {
      headers: { Origin: "https://aresfirst.org" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://aresfirst.org");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("allows preview channels and requests without an Origin header", async () => {
    const preview = await fetch(`${baseUrl}/api/example`, {
      headers: { Origin: "https://aresfirst-portal--preview-123.web.app" },
    });
    expect(preview.headers.get("access-control-allow-origin")).toBe(
      "https://aresfirst-portal--preview-123.web.app",
    );

    const serverRequest = await fetch(`${baseUrl}/api/example`);
    expect(serverRequest.status).toBe(200);
  });

  it("does not grant CORS access to an unrelated origin", async () => {
    const response = await fetch(`${baseUrl}/api/example`, {
      headers: { Origin: "https://attacker.example" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns a bounded JSON 404 instead of Express HTML", async () => {
    const response = await fetch(`${baseUrl}/api/not-mounted`);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "API route not found." });
  });
});
