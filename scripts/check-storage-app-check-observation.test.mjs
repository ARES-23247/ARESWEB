import { describe, expect, it, vi } from "vitest";
import {
  assessStorageObservation,
  buildMonitoringUrl,
  main,
  parseObservationArgs,
  queryStorageAppCheckMetrics,
  readGcloudAccessToken,
  summarizeVerificationSeries,
} from "./check-storage-app-check-observation.mjs";

const START = "2026-08-24T06:25:12.000Z";

function options(hours = 72) {
  return {
    project: "aresfirst-portal",
    start: new Date(START),
    end: new Date(new Date(START).getTime() + hours * 60 * 60 * 1_000),
    minimumHours: 72,
    requireReady: false,
  };
}

describe("Storage App Check observation arguments", () => {
  it("requires an explicit project and start while accounting for metric delay", () => {
    const now = new Date("2026-08-27T06:30:12.000Z");
    expect(
      parseObservationArgs(
        ["--project", "aresfirst-portal", "--start", START, "--require-ready"],
        now,
      ),
    ).toEqual({
      project: "aresfirst-portal",
      start: new Date(START),
      end: new Date("2026-08-27T06:27:12.000Z"),
      minimumHours: 72,
      requireReady: true,
    });
    expect(() => parseObservationArgs([], now)).toThrow("--project");
    expect(() =>
      parseObservationArgs(["--project", "bad", "--start", START], now),
    ).toThrow("--project");
    expect(() =>
      parseObservationArgs(["--project", "aresfirst-portal"], now),
    ).toThrow("--start");
  });

  it("validates timestamps, duration, option values, and ordering", () => {
    const base = ["--project", "aresfirst-portal", "--start", START];
    expect(
      parseObservationArgs(
        [...base, "--end", "2026-08-25T06:25:12Z", "--minimum-hours", "24"],
      ).minimumHours,
    ).toBe(24);
    expect(() => parseObservationArgs([...base, "--end", "not-a-date"])).toThrow(
      "ISO-8601",
    );
    expect(() => parseObservationArgs([...base, "--minimum-hours", "0"])).toThrow(
      "minimum-hours",
    );
    expect(() => parseObservationArgs([...base, "--minimum-hours", "745"])).toThrow(
      "minimum-hours",
    );
    expect(() => parseObservationArgs([...base, "--end", START])).toThrow(
      "earlier",
    );
    expect(() => parseObservationArgs([...base, "--end"])).toThrow("requires");
    expect(() => parseObservationArgs([...base, "--unknown", "value"])).toThrow(
      "Unknown argument",
    );
  });
});

describe("Storage App Check Monitoring query", () => {
  it("builds a product-scoped, bounded Monitoring URL with pagination", () => {
    const url = buildMonitoringUrl(options(), "next-token");
    expect(url.origin).toBe("https://monitoring.googleapis.com");
    expect(url.pathname).toBe(
      "/v3/projects/aresfirst-portal/timeSeries",
    );
    expect(url.searchParams.get("filter")).toContain(
      'resource.labels.service_id="firebasestorage.googleapis.com"',
    );
    expect(url.searchParams.get("interval.startTime")).toBe(START);
    expect(url.searchParams.get("pageToken")).toBe("next-token");
  });

  it("aggregates safe counts without retaining app identifiers", () => {
    expect(
      summarizeVerificationSeries([
        {
          metric: { labels: { security: "VALID", result: "ALLOW", app_id: "public-app" } },
          points: [{ value: { int64Value: "2" } }, { value: { int64Value: "3" } }],
        },
        {
          metric: { labels: { security: "MISSING_UNKNOWN_ORIGIN", result: "ALLOW" } },
          points: [{ value: { int64Value: "4" } }],
        },
        { metric: { labels: {} }, points: [{ value: { int64Value: "0" } }] },
      ]),
    ).toEqual({
      total: 9,
      bySecurity: { VALID: 5, MISSING_UNKNOWN_ORIGIN: 4 },
      byResult: { ALLOW: 9 },
    });
    expect(() =>
      summarizeVerificationSeries([{ points: [{ value: { int64Value: "-1" } }] }]),
    ).toThrow("invalid verification count");
  });

  it("retrieves every Monitoring page and rejects failed responses", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            timeSeries: [
              {
                metric: { labels: { security: "VALID", result: "ALLOW" } },
                points: [{ value: { int64Value: "2" } }],
              },
            ],
            nextPageToken: "page-2",
          }),
        ),
      )
      .mockResolvedValueOnce(new Response("{}"));
    await expect(
      queryStorageAppCheckMetrics(options(), { fetchImpl, accessToken: "token" }),
    ).resolves.toEqual({
      total: 2,
      bySecurity: { VALID: 2 },
      byResult: { ALLOW: 2 },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0].searchParams.get("pageToken")).toBe("page-2");

    await expect(
      queryStorageAppCheckMetrics(options(), {
        fetchImpl: vi.fn().mockResolvedValue(new Response("denied", { status: 403 })),
        accessToken: "token",
      }),
    ).rejects.toThrow("HTTP 403");
  });
});

describe("Storage App Check assessment", () => {
  it("distinguishes incomplete, review-required, and enforcement-review states", () => {
    expect(assessStorageObservation(options(24), { total: 0 }).status).toBe(
      "OBSERVING",
    );
    expect(assessStorageObservation(options(72), { total: 1 })).toEqual(
      expect.objectContaining({
        status: "REVIEW_REQUIRED",
        windowComplete: true,
        readyForManualEnforcementReview: false,
      }),
    );
    expect(assessStorageObservation(options(72), { total: 0 })).toEqual(
      expect.objectContaining({
        status: "READY_FOR_MANUAL_ENFORCEMENT_REVIEW",
        windowComplete: true,
        readyForManualEnforcementReview: true,
      }),
    );
  });

  it("obtains a token without logging it and rejects invalid command results", () => {
    const spawnImpl = vi.fn().mockReturnValue({ status: 0, stdout: "safe-token\n" });
    expect(readGcloudAccessToken(spawnImpl, "linux")).toBe("safe-token");
    expect(spawnImpl).toHaveBeenCalledWith(
      "gcloud",
      ["auth", "print-access-token"],
      expect.objectContaining({ encoding: "utf8" }),
    );
    expect(
      readGcloudAccessToken(spawnImpl, "win32", "C:\\Windows\\cmd.exe"),
    ).toBe("safe-token");
    expect(() =>
      readGcloudAccessToken(
        vi.fn().mockReturnValue({ status: 1, stdout: "" }),
        "linux",
      ),
    ).toThrow("Unable to obtain");
    expect(() =>
      readGcloudAccessToken(
        vi.fn().mockReturnValue({ status: 0, stdout: "bad token" }),
        "linux",
      ),
    ).toThrow("Unable to obtain");
  });

  it("prints a redacted report and can require a complete clean window", async () => {
    const logger = { log: vi.fn() };
    const argv = [
      "--project",
      "aresfirst-portal",
      "--start",
      START,
      "--end",
      "2026-08-27T06:25:12.000Z",
      "--require-ready",
    ];
    const report = await main(argv, {
      logger,
      accessToken: "token",
      fetchImpl: vi.fn().mockResolvedValue(new Response("{}")),
    });
    expect(report.assessment.readyForManualEnforcementReview).toBe(true);
    expect(logger.log).toHaveBeenCalledWith(expect.not.stringContaining("token"));

    await expect(
      main(
        [
          "--project",
          "aresfirst-portal",
          "--start",
          START,
          "--end",
          "2026-08-25T06:25:12.000Z",
          "--require-ready",
        ],
        {
          logger,
          accessToken: "token",
          fetchImpl: vi.fn().mockResolvedValue(new Response("{}")),
        },
      ),
    ).rejects.toThrow("not ready");
  });
});
