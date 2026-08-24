import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SponsorsManagerPage from "../app/dashboard/sponsors/page";
import OutreachManagerPage from "../app/dashboard/outreach/page";
import { authenticatedFetch } from "../lib/api";

const authState = vi.hoisted(() => ({ user: { uid: "admin-1" } }));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => authState,
  useOptionalAuth: () => undefined,
}));

vi.mock("../lib/api", () => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  getDocs: vi.fn(async () => ({ docs: [] })),
  onSnapshot: vi.fn((_reference, onNext: (snapshot: { docs: unknown[] }) => void) => {
    onNext({ docs: [] });
    return vi.fn();
  }),
}));

function response(body: object, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
  } as Response;
}

describe("partner lifecycle managers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: vi.fn(() => "blob:sponsor-logo-preview") },
      revokeObjectURL: { configurable: true, value: vi.fn() },
    });
  });

  it("archives and restores sponsors without browser confirmation dialogs", async () => {
    vi.mocked(authenticatedFetch).mockImplementation(async (url, init) => {
      if (url === "/api/sponsors/admin" && !init) {
        return response({
          sponsors: [
            { id: "active", name: "Active Partner", tier: "Gold", isActive: true, isDeleted: 0 },
            { id: "archived", name: "Archived Partner", tier: "Silver", isActive: false, isDeleted: 1 },
          ],
        });
      }
      return response({ success: true });
    });

    render(<SponsorsManagerPage />);

    await screen.findByText("Active Partner");
    fireEvent.click(screen.getByRole("button", { name: "Archive Active Partner" }));
    expect(await screen.findByRole("group", { name: "Confirm archive for Active Partner" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));

    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/sponsors/admin/active",
      { method: "DELETE" },
    ));
    expect(await screen.findByText(/Active Partner was archived/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restore Archived Partner" }));
    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/sponsors/admin/archived/restore",
      { method: "PATCH" },
    ));
    expect(await screen.findByText(/Archived Partner was restored as inactive/i)).toBeInTheDocument();
  });

  it("shows HTTP diagnostics when sponsor loading fails", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(response(
      { error: "Sponsor service unavailable." },
      503,
      "Service Unavailable",
    ));

    render(<SponsorsManagerPage />);

    expect(await screen.findByText("HTTP 503: Service Unavailable")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Sponsor service unavailable.");
  });

  it("keeps the sponsor draft when a save request fails", async () => {
    vi.mocked(authenticatedFetch).mockImplementation(async (url, init) => {
      if (url === "/api/sponsors/admin" && !init) return response({ sponsors: [] });
      return response({ error: "Sponsor write rejected." }, 409, "Conflict");
    });

    render(<SponsorsManagerPage />);
    await screen.findByText("No Sponsors Listed");

    const nameInput = screen.getByLabelText("Sponsor Name *");
    fireEvent.change(nameInput, { target: { value: "Draft Partner" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("HTTP 409: Conflict")).toBeInTheDocument();
    expect(nameInput).toHaveValue("Draft Partner");
  });

  it("uploads sponsor logos through the authenticated media API", async () => {
    vi.mocked(authenticatedFetch).mockImplementation(async (url, init) => {
      if (url === "/api/sponsors/admin" && !init) return response({ sponsors: [] });
      if (url === "/api/photos/sponsor-logo") {
        return response({
          logo: {
            assetId: "123e4567-e89b-42d3-a456-426614174000",
            previewUrl: "/api/photos/admin/sponsor-logo-assets/123e4567-e89b-42d3-a456-426614174000",
          },
        }, 201, "Created");
      }
      if (url === "/api/photos/admin/sponsor-logo-assets/123e4567-e89b-42d3-a456-426614174000") {
        return new Response(new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      }
      return response({ success: true });
    });

    render(<SponsorsManagerPage />);
    await screen.findByText("No Sponsors Listed");
    expect(screen.queryByPlaceholderText("Logo URL (or upload below)")).not.toBeInTheDocument();
    const file = new File([new Uint8Array([137, 80, 78, 71])], "logo.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByLabelText("Click to Upload Logo"), {
      target: { files: [file] },
    });

    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/photos/sponsor-logo",
      { method: "POST", headers: { "Content-Type": "image/png" }, body: file },
    ));
    expect(await screen.findByAltText("Sponsor logo preview")).toHaveAttribute(
      "src",
      "blob:sponsor-logo-preview",
    );
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/photos/admin/sponsor-logo-assets/123e4567-e89b-42d3-a456-426614174000",
    );
    expect(screen.getByText("Uploaded logo asset")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Logo uploaded");

    fireEvent.change(screen.getByLabelText("Sponsor Name *"), {
      target: { value: "Uploaded Partner" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const saveCall = vi.mocked(authenticatedFetch).mock.calls.find(
        ([url, init]) => url === "/api/sponsors/admin" && init?.method === "POST",
      );
      expect(saveCall).toBeDefined();
      expect(JSON.parse(String(saveCall?.[1]?.body))).toEqual(expect.objectContaining({
        name: "Uploaded Partner",
        logoAssetId: "123e4567-e89b-42d3-a456-426614174000",
      }));
    });
  });

  it("archives and restores outreach logs through the server", async () => {
    vi.mocked(authenticatedFetch).mockImplementation(async (url, init) => {
      if (url === "/api/outreach/admin" && !init) {
        return response({
          logs: [
            { id: "active-log", title: "Library Demo", date: "2026-05-01", hours: 4, peopleReached: 25, isDeleted: 0 },
            { id: "archived-log", title: "Archived Demo", date: "2026-04-01", hours: 2, peopleReached: 10, isDeleted: 1 },
          ],
        });
      }
      return response({ success: true });
    });

    render(<OutreachManagerPage />);

    await screen.findByText("Library Demo");
    fireEvent.click(screen.getByRole("button", { name: "Archive Library Demo" }));
    expect(await screen.findByRole("group", { name: "Confirm archive for Library Demo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));

    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/outreach/admin/active-log",
      { method: "DELETE" },
    ));
    expect(await screen.findByText(/Library Demo was archived/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restore Archived Demo" }));
    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/outreach/admin/archived-log/restore",
      { method: "PATCH" },
    ));
    expect(await screen.findByText(/Archived Demo was restored/i)).toBeInTheDocument();
  });
});
