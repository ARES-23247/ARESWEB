import { describe, expect, it, vi } from "vitest";
import {
  fetchFtcScoutEventData,
  normalizeFtcScoutPayload,
} from "../ftcScoutSync";
import { ApiError } from "../../middleware/errorHandler";

describe("ftcScoutSync", () => {
  it("normalizes FTCScout event, team stats, and ARES #23247 matches accurately", () => {
    const normalized = normalizeFtcScoutPayload(
      2026,
      "USWVMOQ",
      {
        name: "Morgantown Qualifier",
        start: "2026-12-05",
        location: { city: "Morgantown", state: "WV", venue: "Morgantown High" },
      },
      [
        {
          teamNumber: 23247,
          team: { nameFull: "ARES Robotics", nameShort: "ARES" },
          stats: {
            rank: 2,
            wins: 5,
            losses: 1,
            ties: 0,
            opr: { totalPointsNp: 118.44, autoPoints: 38.2, dcPoints: 62.1, egPoints: 18.14 },
          },
        },
        {
          teamNumber: 11115,
          team: { nameShort: "Gluten Free" },
          stats: {
            rank: 1,
            wins: 6,
            losses: 0,
            ties: 0,
            opr: { totalPoints: 132.9, autoPoints: 44.0, dcPoints: 70.4, egPoints: 18.5 },
          },
        },
        {
          teamNumber: -1,
          stats: {},
        },
      ],
      [
        {
          id: 1,
          tournamentLevel: "Quals",
          series: 0,
          matchNum: 4,
          hasBeenPlayed: true,
          scores: {
            red: { totalPoints: 145 },
            blue: { totalPoints: 112 },
          },
          teams: [
            { alliance: "Red", teamNumber: 23247 },
            { alliance: "Red", teamNumber: 11115 },
            { alliance: "Blue", teamNumber: 18225 },
            { alliance: "Blue", teamNumber: 19999 },
          ],
        },
        {
          id: 2,
          tournamentLevel: "Semis",
          series: 1,
          matchNum: 2,
          hasBeenPlayed: false,
          teams: [
            { alliance: "Blue", teamNumber: 23247 },
            { alliance: "Blue", teamNumber: 14444 },
            { alliance: "Red", teamNumber: 18225 },
            { alliance: "Red", teamNumber: 19999 },
          ],
        },
        {
          id: 3,
          tournamentLevel: "DoubleElim",
          series: 3,
          matchNum: 1,
          hasBeenPlayed: true,
          scores: { red: { totalPoints: 120 }, blue: { totalPoints: 120 } },
          teams: [
            { alliance: "Red", teamNumber: 23247 },
            { alliance: "Blue", teamNumber: 18225 },
          ],
        },
        {
          id: 4,
          tournamentLevel: "Finals",
          series: 0,
          matchNum: 1,
          hasBeenPlayed: true,
          scores: { red: { totalPoints: 90 }, blue: { totalPoints: 130 } },
          teams: [
            { alliance: "Red", teamNumber: 23247 },
            { alliance: "Red", teamNumber: 11115 },
            { alliance: "Blue", teamNumber: 18225 },
          ],
        },
        {
          id: 5,
          tournamentLevel: "Quals",
          matchNum: 9,
          hasBeenPlayed: true,
          teams: [
            { alliance: "Red", teamNumber: 11115 },
            { alliance: "Blue", teamNumber: 18225 },
          ],
        },
      ],
      23247,
    );

    expect(normalized.eventName).toBe("Morgantown Qualifier");
    expect(normalized.eventDate).toBe("2026-12-05");
    expect(normalized.eventLocation).toBe("Morgantown High, Morgantown, WV");
    expect(normalized.aresOpr).toBe(118.4);
    expect(normalized.aresRank).toBe(2);
    expect(normalized.wins).toBe(5);
    expect(normalized.losses).toBe(1);
    expect(normalized.ties).toBe(0);
    expect(normalized.oprList).toHaveLength(2);
    expect(normalized.oprList[0]).toMatchObject({
      teamNumber: "11115",
      teamName: "Gluten Free",
      opr: 132.9,
      autoOpr: 44,
      teleopOpr: 70.4,
      endgameOpr: 18.5,
      rank: 1,
    });
    expect(normalized.aresMatches).toHaveLength(4);
    expect(normalized.aresMatches[0]).toMatchObject({
      matchNumber: "QM4",
      alliance: "red",
      partner: "11115",
      opponents: ["18225", "19999"],
      scoreSelf: 145,
      scoreOpponent: 112,
      result: "won",
      completed: true,
    });
    expect(normalized.aresMatches[1]).toMatchObject({
      matchNumber: "SF1-2",
      alliance: "blue",
      partner: "14444",
      result: "upcoming",
      completed: false,
    });
    expect(normalized.aresMatches[2]).toMatchObject({
      matchNumber: "M3",
      partner: "TBD",
      result: "tie",
      completed: true,
    });
    expect(normalized.aresMatches[3]).toMatchObject({
      matchNumber: "F1",
      result: "lost",
      completed: true,
    });
  });

  it("derives W-L-T from played ARES matches when team stats omit record counts", () => {
    const normalized = normalizeFtcScoutPayload(
      2026,
      "USWVTEST",
      {},
      [{ teamNumber: 23247, team: "ARES" }],
      [
        {
          tournamentLevel: "Quals",
          matchNum: 1,
          hasBeenPlayed: true,
          scores: { red: 100, blue: 80 },
          teams: [
            { alliance: "Red", teamNumber: 23247 },
            { alliance: "Red", teamNumber: 100 },
            { alliance: "Blue", teamNumber: 200 },
          ],
        },
      ],
      23247,
    );

    expect(normalized.wins).toBe(1);
    expect(normalized.losses).toBe(0);
    expect(normalized.ties).toBe(0);
    expect(normalized.oprList[0]?.teamName).toBe("ARES");
  });

  it("fetches from FTCScout REST endpoints and handles 404 or upstream failures cleanly", async () => {
    const okFetch = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.endsWith("/teams")) {
        return new Response(JSON.stringify([{ teamNumber: 23247, stats: { opr: 88.5 } }]), { status: 200 });
      }
      if (href.endsWith("/matches")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(JSON.stringify({ name: "WV State", start: "2026-02-20" }), { status: 200 });
    });

    const synced = await fetchFtcScoutEventData(2026, "uswvstate", 23247, okFetch as unknown as typeof fetch);
    expect(synced.ftcEventCode).toBe("USWVSTATE");
    expect(synced.aresOpr).toBe(88.5);
    expect(okFetch).toHaveBeenCalledTimes(3);

    const notFoundFetch = vi.fn(async () => new Response("Not Found", { status: 404 }));
    await expect(
      fetchFtcScoutEventData(2026, "MISSING", 23247, notFoundFetch as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(ApiError);

    const errorFetch = vi.fn(async () => new Response("Bad Gateway", { status: 502 }));
    await expect(
      fetchFtcScoutEventData(2026, "BROKEN", 23247, errorFetch as unknown as typeof fetch),
    ).rejects.toMatchObject({ status: 502 });

    await expect(
      fetchFtcScoutEventData(2015, "INVALID", 23247, okFetch as unknown as typeof fetch),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      fetchFtcScoutEventData(2026, "bad code!", 23247, okFetch as unknown as typeof fetch),
    ).rejects.toMatchObject({ status: 400 });
  });
});
