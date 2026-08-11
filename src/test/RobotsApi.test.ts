import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatedFetch } from "../lib/api";
import {
  canEmbedCadUrl,
  canManageRobots,
  createRobot,
  decommissionRobot,
  fetchRobot,
  fetchRobots,
  isSafeExternalUrl,
  restoreRobot,
  updateRobot,
} from "../app/robots/api";

vi.mock("../lib/api", () => ({ authenticatedFetch: vi.fn() }));

describe("robot API client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it.each(["admin", "coach", "mentor"])("allows the %s editor role", (role) => {
    expect(canManageRobots(role)).toBe(true);
  });

  it.each([undefined, null, "student", "member", "unverified"])("denies the %s role", (role) => {
    expect(canManageRobots(role)).toBe(false);
  });

  it("only embeds HTTPS cad.onshape.com URLs", () => {
    expect(canEmbedCadUrl("https://cad.onshape.com/documents/abc")).toBe(true);
    expect(canEmbedCadUrl("http://cad.onshape.com/documents/abc")).toBe(false);
    expect(canEmbedCadUrl("https://example.com/viewer")).toBe(false);
    expect(canEmbedCadUrl("https://cad.onshape.com:444/documents/abc")).toBe(false);
    expect(canEmbedCadUrl("https://user:password@cad.onshape.com/documents/abc")).toBe(false);
    expect(canEmbedCadUrl("not a URL")).toBe(false);
    expect(canEmbedCadUrl(undefined)).toBe(false);
  });

  it("only treats HTTPS URLs as safe external links", () => {
    expect(isSafeExternalUrl("https://example.com")).toBe(true);
    expect(isSafeExternalUrl("http://example.com")).toBe(false);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("https://user:password@example.com")).toBe(false);
    expect(isSafeExternalUrl(undefined)).toBe(false);
  });

  it("loads public and editor fleet DTOs from the correct endpoints", async () => {
    const payload = { success: true, robots: [{ id: "r1", name: "Prime" }], nextCursor: null };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    await expect(fetchRobots()).resolves.toEqual(payload.robots);
    await expect(fetchRobots(true)).resolves.toEqual(payload.robots);
    expect(fetch).toHaveBeenCalledWith("/api/robots?limit=100");
    expect(authenticatedFetch).toHaveBeenCalledWith("/api/robots/admin?limit=100");
  });

  it("loads one robot with an encoded ID", async () => {
    const robot = { id: "a b", name: "Prime" };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ success: true, robot }), { status: 200 }));
    await expect(fetchRobot("a b")).resolves.toEqual(robot);
    expect(fetch).toHaveBeenCalledWith("/api/robots/a%20b");
  });

  it("sends typed create and update payloads through authenticated requests", async () => {
    const robot = { id: "prime", name: "Prime", seasonName: "2026", challengeName: "Challenge" };
    vi.mocked(authenticatedFetch).mockImplementation(async () => new Response(JSON.stringify({ success: true, robot }), { status: 200 }));
    const data = { name: "Prime", seasonName: "2026", challengeName: "Challenge" };
    await createRobot("prime", data);
    await createRobot("", data);
    await updateRobot("prime", data);
    expect(authenticatedFetch).toHaveBeenNthCalledWith(1, "/api/robots", expect.objectContaining({ method: "POST", body: expect.stringContaining('"id":"prime"') }));
    expect(authenticatedFetch).toHaveBeenNthCalledWith(2, "/api/robots", expect.objectContaining({ body: expect.not.stringContaining('"id"') }));
    expect(authenticatedFetch).toHaveBeenNthCalledWith(3, "/api/robots/prime", expect.objectContaining({ method: "PUT" }));
  });

  it("soft-decommissions and restores through authenticated endpoints", async () => {
    vi.mocked(authenticatedFetch).mockImplementation(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    await decommissionRobot("r/1");
    await restoreRobot("r/1");
    expect(authenticatedFetch).toHaveBeenNthCalledWith(1, "/api/robots/r%2F1", { method: "DELETE" });
    expect(authenticatedFetch).toHaveBeenNthCalledWith(2, "/api/robots/r%2F1/restore", { method: "PATCH" });
  });

  it("exposes numeric HTTP diagnostics and a server error message", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: "Robot not found" }), { status: 404, statusText: "Not Found" }));
    await expect(fetchRobot("missing")).rejects.toMatchObject({
      status: 404,
      statusText: "Not Found",
      message: "HTTP 404 Not Found: Robot not found",
    });
  });

  it("keeps HTTP diagnostics when an upstream error is not JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("offline", { status: 503, statusText: "Unavailable" }));
    await expect(fetchRobot("r1")).rejects.toThrow("HTTP 503 Unavailable");
  });
});
