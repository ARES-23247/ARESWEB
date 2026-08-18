import { authenticatedFetch } from "@/lib/api";
import type { RobotEditorRole, RobotItem } from "./types";

interface RobotsResponse {
  success: boolean;
  robots: RobotItem[];
  nextCursor: string | null;
}

interface RobotResponse {
  success: boolean;
  robot: RobotItem;
}

export class RobotApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    detail: string,
  ) {
    super(`HTTP ${status} ${statusText}${detail ? `: ${detail}` : ""}`);
    this.name = "RobotApiError";
  }
}

export function canManageRobots(role: string | null | undefined): role is RobotEditorRole {
  return role === "admin" || role === "coach" || role === "mentor";
}

export function canEmbedCadUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.toLowerCase() === "cad.onshape.com" && url.port === "" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

export function isSafeExternalUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

export function isTrustedPrintablesUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (host === "printables.com" || host === "www.printables.com") &&
      url.port === "" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

async function errorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown; message?: unknown };
    if (typeof body.error === "string") return body.error;
    if (typeof body.message === "string") return body.message;
  } catch {
    // The HTTP status is still actionable when an upstream returns non-JSON.
  }
  return "";
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new RobotApiError(response.status, response.statusText, await errorDetail(response));
  }
  return await response.json() as T;
}

export async function fetchRobots(includeArchived = false): Promise<RobotItem[]> {
  const response = includeArchived
    ? await authenticatedFetch("/api/robots/admin?limit=100")
    : await fetch("/api/robots?limit=100");
  return (await readJson<RobotsResponse>(response)).robots;
}

export async function fetchRobot(id: string): Promise<RobotItem> {
  const response = await fetch(`/api/robots/${encodeURIComponent(id)}`);
  return (await readJson<RobotResponse>(response)).robot;
}

export async function createRobot(id: string, data: Omit<RobotItem, "id" | "isDeleted">): Promise<RobotItem> {
  const response = await authenticatedFetch("/api/robots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, ...(id ? { id } : {}) }),
  });
  return (await readJson<RobotResponse>(response)).robot;
}

export async function updateRobot(id: string, data: Omit<RobotItem, "id" | "isDeleted">): Promise<RobotItem> {
  const response = await authenticatedFetch(`/api/robots/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return (await readJson<RobotResponse>(response)).robot;
}

export async function decommissionRobot(id: string): Promise<void> {
  await readJson(await authenticatedFetch(`/api/robots/${encodeURIComponent(id)}`, { method: "DELETE" }));
}

export async function restoreRobot(id: string): Promise<void> {
  await readJson(await authenticatedFetch(`/api/robots/${encodeURIComponent(id)}/restore`, { method: "PATCH" }));
}
