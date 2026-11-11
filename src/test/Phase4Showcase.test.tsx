import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import SeasonsPage from "@/app/seasons/page";
import PublicResults from "@/app/tournaments/PublicResults";
import SponsorFactSheetSection from "@/app/sponsors/SponsorFactSheetSection";

function jsonRes(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 503,
    statusText: ok ? "OK" : "Service Unavailable",
    json: async () => body,
  } as Response;
}

describe("Phase 4 — Public Judge, Sponsor & Partner Showcase", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders cross-linked Season Dossiers with direct Robot Dossier links, awards, and competitions", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/seasons")) {
        return jsonRes({
          seasons: [
            {
              id: "season_2026",
              startYear: 2026,
              endYear: 2027,
              challengeName: "BIOBUZZ",
              robotId: "ares-mk4",
              robotName: "ARES MK-IV",
              robotDescription: "Dual-stage linear slide with Pinpoint odometry.",
              robotCadUrl: "https://cad.onshape.com/documents/aresmk4",
              albumUrl: "https://photos.example/biobuzz",
              summary: "Regional finalists and Control Award winners.",
              status: "published",
            },
          ],
        });
      }
      if (url.startsWith("/api/awards")) {
        return jsonRes({
          awards: [
            {
              id: "aw_1",
              title: "Control Award 1st Place",
              eventName: "Morgantown Qualifier",
              date: "2026-11-08",
              description: "Closed-loop turret and vision fusion.",
              iconType: "trophy",
              seasonId: "season_2026",
              status: "published",
            },
          ],
        });
      }
      if (url.startsWith("/api/tournaments/public/results")) {
        return jsonRes({
          results: [
            {
              id: "t_morgantown",
              name: "Morgantown Qualifier",
              seasonName: "2026-2027",
              challengeName: "BIOBUZZ",
              date: "2026-11-08",
              location: "Morgantown, WV",
              description: "",
              status: "past",
              opr: 58.4,
            },
          ],
        });
      }
      return jsonRes({});
    });

    render(
      <HelmetProvider>
        <MemoryRouter>
          <SeasonsPage />
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(await screen.findByText("BIOBUZZ")).toBeInTheDocument();
    const dossierLinks = screen.getAllByRole("link", { name: /ROBOT DOSSIER/i });
    expect(dossierLinks[0]).toHaveAttribute("href", "/robots/ares-mk4");
    expect(await screen.findByText(/Morgantown Qualifier \(OPR 58\.4\)/i)).toBeInTheDocument();
    expect(screen.getAllByText("Control Award 1st Place").length).toBeGreaterThanOrEqual(1);
  });

  it("filters PublicResults by Upcoming vs Completed and displays Rank and W-L-T badges", async () => {
    fetchMock.mockResolvedValue(
      jsonRes({
        results: [
          {
            id: "t_past",
            name: "WV State Championship",
            seasonName: "2026-2027",
            challengeName: "BIOBUZZ",
            date: "2026-02-20",
            location: "Fairmont, WV",
            description: "Winning Alliance Captain.",
            status: "past",
            opr: 64.5,
            rank: 1,
            record: { wins: 6, losses: 0, ties: 0 },
          },
          {
            id: "t_next",
            name: "Appalachian Invitational",
            seasonName: "2026-2027",
            challengeName: "BIOBUZZ",
            date: "2026-12-12",
            location: "Morgantown, WV",
            description: "Registered.",
            status: "upcoming",
            opr: null,
          },
        ],
      }),
    );

    render(<PublicResults />);

    expect(await screen.findByText("WV State Championship")).toBeInTheDocument();
    expect(screen.getByText("Rank #1")).toBeInTheDocument();
    expect(screen.getByText("6-0-0")).toBeInTheDocument();
    expect(screen.getByText("64.5")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Upcoming \(1\)/i }));
    expect(screen.getByText("Appalachian Invitational")).toBeInTheDocument();
    expect(screen.queryByText("WV State Championship")).not.toBeInTheDocument();
  });

  it("loads live verified outreach, season, and award stats into SponsorFactSheetSection with QR SVG", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/outreach")) {
        return jsonRes({
          logs: [
            { hours: 24.5, peopleReached: 180 },
            { hours: 15.5, peopleReached: 120 },
          ],
        });
      }
      if (url.startsWith("/api/seasons")) {
        return jsonRes({ seasons: [{ id: "s1" }, { id: "s2" }] });
      }
      if (url.startsWith("/api/awards")) {
        return jsonRes({ awards: [{ id: "a1" }, { id: "a2" }, { id: "a3" }] });
      }
      return jsonRes({});
    });

    render(<SponsorFactSheetSection publishedPartnerCount={5} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Printable Team & Sponsor Fact Sheet/i }),
    );

    expect(await screen.findByText("300")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /QR code for ARES 23247 sponsorship page/i }),
    ).toBeInTheDocument();
  });
});
