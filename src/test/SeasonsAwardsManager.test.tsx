import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SeasonsAwardsManagerPage from "../app/dashboard/seasons/page";
import { authenticatedFetch } from "../lib/api";

const authState = vi.hoisted(() => ({
  authorizedUser: { role: "admin" as "admin" | "member" },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => authState,
  useOptionalAuth: () => authState,
}));

vi.mock("../lib/api", () => ({
  authenticatedFetch: vi.fn(),
}));

function response(body: object, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: async () => body,
  } as Response;
}

describe("seasons & awards manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.authorizedUser = { role: "admin" };
  });

  it("renders published and archived records from the admin API", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(
        response({
          seasons: [
            { id: "season_2026", startYear: 2026, endYear: null, challengeName: "DECODE", robotName: "Phobos II", summary: null, status: "published", isDeleted: 0 },
            { id: "season_2019", startYear: 2019, endYear: null, challengeName: "Skystone", robotName: null, summary: null, status: "published", isDeleted: 1, archivedAt: "2026-01-01" },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({
          awards: [
            { id: "award_1", title: "Inspire Award", eventName: "WV States", date: "2026-02-01", description: null, iconType: "trophy", seasonId: "season_2026", status: "published", isDeleted: 0 },
          ],
        }),
      );

    render(<SeasonsAwardsManagerPage />);

    await waitFor(() => {
      expect(screen.getByText(/DECODE/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Inspire Award/)).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByText("Restore")).toBeInTheDocument();
  });

  it("shows an explicit error state instead of empty lists when the API fails", async () => {
    vi.mocked(authenticatedFetch).mockRejectedValue(new Error("HTTP 503"));

    render(<SeasonsAwardsManagerPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("unavailable: HTTP 503");
    });
    expect(screen.queryByText(/No seasons recorded yet/)).not.toBeInTheDocument();
  });

  it("opens the season editor, submits bounded fields, and reloads", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response({ seasons: [] }))
      .mockResolvedValueOnce(response({ awards: [] }))
      .mockResolvedValueOnce(response({ success: true, id: "season_2027" }))
      .mockResolvedValueOnce(response({ seasons: [] }))
      .mockResolvedValueOnce(response({ awards: [] }));

    render(<SeasonsAwardsManagerPage />);
    fireEvent.click(await screen.findByRole("button", { name: /New season/ }));

    await fireEvent.change(screen.getByLabelText(/Challenge name/), {
      target: { value: "NEXT SEASON" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create season/ }));

    await waitFor(() => {
      expect(authenticatedFetch).toHaveBeenCalledWith(
        "/api/seasons/admin",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const body = JSON.parse(
      (vi.mocked(authenticatedFetch).mock.calls[2][1] as RequestInit).body as string,
    );
    expect(body).toMatchObject({ startYear: new Date().getFullYear(), challengeName: "NEXT SEASON" });
    expect(screen.queryByRole("button", { name: /Create season/ })).not.toBeInTheDocument();
  });

  it("denies members who are not publishers", async () => {
    authState.authorizedUser = { role: "member" };
    render(<SeasonsAwardsManagerPage />);
    expect(
      screen.getByText(/Only an admin, coach, or mentor can manage seasons and awards/),
    ).toBeInTheDocument();
    expect(authenticatedFetch).not.toHaveBeenCalled();
  });
});
