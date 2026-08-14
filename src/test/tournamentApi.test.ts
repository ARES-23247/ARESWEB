import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatedFetch } from "@/lib/api";
import {
  archiveTournament,
  archiveTournamentMatch,
  createTournament,
  createTournamentMatch,
  fetchTournament,
  fetchTournamentMatches,
  fetchTournaments,
  setTournamentMatchCompletion,
  TournamentApiError,
  updateTournament,
  updateTournamentMatch,
} from "@/lib/tournamentApi";

vi.mock("@/lib/api", () => ({ authenticatedFetch: vi.fn() }));

const tournament = {
  id: "states",
  name: "State Championship",
  date: "2026-03-14",
  location: "Fairmont, WV",
  status: "past" as const,
  isDeleted: 0,
};

const match = {
  id: "qm-1",
  tournamentId: "states",
  matchNumber: "QM1",
  alliance: "red" as const,
  partner: "12345",
  opponents: ["54321"],
  result: "upcoming" as const,
  completed: false,
  isDeleted: 0,
  updatedAt: "2026-08-14T09:00:00.000Z",
};

function jsonResponse(
  payload: unknown,
  status = 200,
  statusText = "OK",
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

describe("tournament API client", () => {
  beforeEach(() => vi.resetAllMocks());

  it("uses bounded encoded read endpoints", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(
        jsonResponse({ success: true, tournaments: [tournament] }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, tournament }))
      .mockResolvedValueOnce(jsonResponse({ success: true, matches: [match] }));

    await expect(fetchTournaments(500)).resolves.toEqual([tournament]);
    await expect(fetchTournament("states/finals")).resolves.toEqual(tournament);
    await expect(fetchTournamentMatches("states/finals", 999)).resolves.toEqual(
      [match],
    );

    expect(authenticatedFetch).toHaveBeenNthCalledWith(
      1,
      "/api/tournaments?limit=100",
      undefined,
    );
    expect(authenticatedFetch).toHaveBeenNthCalledWith(
      2,
      "/api/tournaments/states%2Ffinals",
      undefined,
    );
    expect(authenticatedFetch).toHaveBeenNthCalledWith(
      3,
      "/api/tournaments/states%2Ffinals/matches?limit=250",
      undefined,
    );
  });

  it("routes tournament mutations through authenticated JSON requests", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(jsonResponse({ success: true, tournament }))
      .mockResolvedValueOnce(jsonResponse({ success: true, tournament }))
      .mockResolvedValueOnce(jsonResponse({ success: true }));

    const input = {
      name: tournament.name,
      date: tournament.date,
      location: tournament.location,
      status: tournament.status,
    };
    await createTournament(input);
    await updateTournament("states", { name: "Updated" });
    await archiveTournament("states");

    expect(authenticatedFetch).toHaveBeenNthCalledWith(
      1,
      "/api/tournaments",
      expect.objectContaining({ method: "POST" }),
    );
    expect(authenticatedFetch).toHaveBeenNthCalledWith(
      2,
      "/api/tournaments/states",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(authenticatedFetch).toHaveBeenNthCalledWith(
      3,
      "/api/tournaments/states",
      { method: "DELETE" },
    );
  });

  it("routes every match mutation through the tournament API", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(jsonResponse({ success: true, match }))
      .mockResolvedValueOnce(jsonResponse({ success: true, match }))
      .mockResolvedValueOnce(
        jsonResponse({ success: true, match: { ...match, completed: true } }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true }));

    const input = {
      matchNumber: match.matchNumber,
      alliance: match.alliance,
      partner: match.partner,
      opponents: match.opponents,
      result: match.result,
      completed: match.completed,
    };
    await createTournamentMatch("states", input);
    await updateTournamentMatch("states", "qm/1", {
      result: "won",
      expectedUpdatedAt: match.updatedAt,
    });
    await setTournamentMatchCompletion("states", "qm/1", true, match.updatedAt);
    await archiveTournamentMatch("states", "qm/1", match.updatedAt);

    expect(authenticatedFetch).toHaveBeenNthCalledWith(
      1,
      "/api/tournaments/states/matches",
      expect.objectContaining({ method: "POST" }),
    );
    expect(authenticatedFetch).toHaveBeenNthCalledWith(
      2,
      "/api/tournaments/states/matches/qm%2F1",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(authenticatedFetch).toHaveBeenNthCalledWith(
      3,
      "/api/tournaments/states/matches/qm%2F1/completion",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(authenticatedFetch).toHaveBeenNthCalledWith(
      4,
      "/api/tournaments/states/matches/qm%2F1",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ expectedUpdatedAt: match.updatedAt }),
      }),
    );

    expect(
      JSON.parse(
        String(vi.mocked(authenticatedFetch).mock.calls[1]?.[1]?.body),
      ),
    ).toMatchObject({ expectedUpdatedAt: match.updatedAt, result: "won" });
    expect(
      JSON.parse(
        String(vi.mocked(authenticatedFetch).mock.calls[2]?.[1]?.body),
      ),
    ).toEqual({ completed: true, expectedUpdatedAt: match.updatedAt });
  });

  it("exposes HTTP status, server message, and error code", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      jsonResponse(
        { error: "Match record no longer exists", code: "MATCH_NOT_FOUND" },
        404,
        "Not Found",
      ),
    );

    await expect(
      setTournamentMatchCompletion("states", "missing", true, match.updatedAt),
    ).rejects.toMatchObject({
      name: "TournamentApiError",
      status: 404,
      statusText: "Not Found",
      code: "MATCH_NOT_FOUND",
      message: "HTTP 404: Not Found — Match record no longer exists",
    } satisfies Partial<TournamentApiError>);
  });

  it("falls back to the HTTP diagnostic when an error body is unreadable", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "",
      json: vi.fn().mockRejectedValue(new Error("invalid json")),
    } as unknown as Response);

    await expect(fetchTournaments(0)).rejects.toThrow(
      "HTTP 503: Request failed",
    );
  });
});
