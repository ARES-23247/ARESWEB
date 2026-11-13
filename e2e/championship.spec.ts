import { expect, test } from "./fixtures";

test.describe("Championship operations & public showcase (Phases 1–4)", () => {
  test("Phase 1: Pit Command checklist, kiosk focus, and offline Stand Scouting outbox sync", async ({
    page,
    context,
    loginAs,
  }) => {
    await context.route("https://firestore.googleapis.com/**", (route) =>
      route.abort("blockedbyclient"),
    );

    let savedChecklists: Record<string, string[]> = {};
    let standSyncedCount = 0;

    await page.route("**/api/tournaments/champ-e2e**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const method = req.method();

      if (url.pathname.endsWith("/matches")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            matches: [
              {
                id: "qm-12",
                tournamentId: "champ-e2e",
                matchNumber: "QM12",
                alliance: "red",
                partner: "11115",
                opponents: ["7172", "8888"],
                result: "upcoming",
                completed: false,
                isDeleted: 0,
              },
            ],
          }),
        });
        return;
      }

      if (url.pathname.endsWith("/pit-state")) {
        if (method === "PUT") {
          const body = JSON.parse(req.postData() || "{}") as {
            checklists?: Record<string, string[]>;
          };
          savedChecklists = body.checklists ?? {};
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            pitState: {
              tournamentId: "champ-e2e",
              checklists: savedChecklists,
              batteries: [
                {
                  id: "bat-a",
                  label: "Pack Alpha",
                  voltage: 13.6,
                  status: "charged",
                  updatedAt: "2026-11-10T18:00:00.000Z",
                },
              ],
              triageItems: [],
              updatedAt: "2026-11-10T18:00:00.000Z",
              updatedByNickname: "Playwright coach",
            },
          }),
        });
        return;
      }

      if (url.pathname.endsWith("/scouting/stand") && method === "POST") {
        standSyncedCount += 1;
        const body = JSON.parse(req.postData() || "{}") as {
          matchNumber: string;
          teamNumber: string;
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            duplicate: false,
            entry: {
              id: "stand-1",
              tournamentId: "champ-e2e",
              matchNumber: body.matchNumber,
              teamNumber: body.teamNumber,
              alliance: "red",
              autoScoreEstimate: 28,
              teleopCycles: 9,
              endgameTier: "high",
              disconnected: false,
              penalties: "none",
              defenseRating: 1,
              scoutedByNickname: "Playwright coach",
              updatedAt: "2026-11-10T18:05:00.000Z",
            },
          }),
        });
        return;
      }

      if (url.pathname.endsWith("/scouting")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            pitScouting: [],
            standScouting: [],
            teamSummaries: [
              {
                teamNumber: "11115",
                teamName: "Gluten Free",
                drivetrain: "Swerve",
                canClearBarrierOrTrench: true,
                matchesObserved: standSyncedCount,
                avgAutoScore: 28,
                avgTeleopCycles: 9,
                highEndgameRate: 1,
                disconnectRate: 0,
                opr: 94.2,
              },
            ],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          tournament: {
            id: "champ-e2e",
            name: "WV State Championship",
            date: "2026-11-21",
            location: "Fairmont, WV",
            seasonName: "2026-2027",
            challengeName: "DECODE",
            status: "upcoming",
            isDeleted: 0,
            oprList: [{ teamNumber: "11115", opr: 94.2, rank: 1 }],
          },
        }),
      });
    });

    await loginAs("coach");
    await page.goto("/tournaments/champ-e2e");

    await expect(
      page.getByRole("heading", { name: "Pre-Match Pit & Queuing Checklist" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("0 / 5 Ready")).toBeVisible();

    await page
      .getByRole("checkbox", { name: /Battery Voltage Verified/i })
      .check();
    await expect(page.getByText("1 / 5 Ready")).toBeVisible();

    const kioskButton = page.getByRole("button", { name: "Launch Pit Kiosk" });
    await kioskButton.click();
    const kioskDialog = page.getByRole("dialog", { name: /Pit Command Kiosk/i });
    await expect(kioskDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(kioskDialog).toBeHidden();
    await expect(kioskButton).toBeFocused();

    // Submit Stand Scouting while venue Wi-Fi is offline -> queued locally in Pit Outbox
    await page.getByLabel("Match # *").fill("QM12");
    await page.getByLabel("Team # *").fill("11115");
    await page.getByLabel("Auto Est. Pts").fill("28");
    await page.getByLabel("TeleOp Cycles").fill("9");

    await context.setOffline(true);
    try {
      await page.getByRole("button", { name: "Submit Stand Report" }).click();
      await expect(page.getByText("1 queued offline")).toBeVisible();
      await expect(
        page.getByText(/saved to Offline Pit Outbox/i),
      ).toBeVisible();
    } finally {
      await context.setOffline(false);
    }

    // Flush outbox once venue Wi-Fi recovers via the browser 'online' listener
    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });
    await expect(
      page.getByText("Synced 1 offline report to team vault."),
    ).toBeVisible();
    await expect(page.getByText("1 queued offline")).toBeHidden();
    expect(standSyncedCount).toBe(1);
  });

  test("Phase 2a: Student 4-digit Lab PIN check-in on Command Center", async ({
    page,
    context,
    loginAs,
  }) => {
    await context.route("https://firestore.googleapis.com/**", (route) =>
      route.abort("blockedbyclient"),
    );

    let submittedPin = "";
    await page.route("**/api/calendar/events*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          events: [
            {
              id: "lab-practice-1",
              title: "Championship Drive Practice",
              dateStart: "2099-03-15T18:00:00.000Z",
              dateEnd: "2099-03-15T20:30:00.000Z",
              location: "ARES Robotics Lab",
              status: "published",
              category: "practice",
            },
          ],
          nextCursor: null,
        }),
      });
    });

    await page.route(
      "**/api/calendar/manage/lab-practice-1/self-checkin",
      async (route) => {
        const body = JSON.parse(route.request().postData() || "{}") as {
          code?: string;
        };
        submittedPin = body.code ?? "";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            attended: true,
            nickname: "Playwright member",
          }),
        });
      },
    );

    await loginAs("member");
    await page.goto("/dashboard");

    await expect(page.getByText("Championship Drive Practice")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByLabel("4-Digit Lab Check-In PIN").fill("4829");
    await page.getByRole("button", { name: "Lab Check-In" }).click();
    await expect(page.getByText("Checked in present!")).toBeVisible();
    expect(submittedPin).toBe("4829");
  });

  test("Phase 2b: Coach Travel & Safety Readiness console and audited emergency binder reveal", async ({
    page,
    context,
    loginAs,
  }) => {
    await context.route("https://firestore.googleapis.com/**", (route) =>
      route.abort("blockedbyclient"),
    );
    await page.addInitScript(() => {
      window.print = () => undefined;
    });

    let revealAuditReason = "";
    await page.route("**/api/profiles/admin/users/list*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          users: [
            {
              id: "student-1",
              email: "student@example.test",
              name: "Maya BuildLead",
              role: "member",
              memberType: "student",
              isRegistered: true,
              zulipLinked: true,
            },
          ],
          nextCursor: null,
          integrations: { zulip: { available: true, diagnostic: null } },
        }),
      });
    });
    await page.route("**/api/profiles/admin/users", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });
    await page.route(
      "**/api/profiles/admin/travel-readiness",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            members: [
              {
                id: "student-1",
                nickname: "Maya BuildLead",
                role: "member",
                memberType: "student",
                subteams: ["Mechanical"],
                tshirtSize: "M",
                dietaryRestrictions: ["Vegetarian"],
                hasEmergencyContact: true,
                firstConsentVerified: true,
                firstConsentUpdatedAt: "2026-11-10T12:00:00.000Z",
              },
            ],
            tshirtCounts: { M: 1 },
            dietaryCounts: { Vegetarian: 1 },
          }),
        });
      },
    );
    await page.route(
      "**/api/profiles/admin/travel-readiness/reveal",
      async (route) => {
        const body = JSON.parse(route.request().postData() || "{}") as {
          reason?: string;
        };
        revealAuditReason = body.reason ?? "";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            packetGeneratedAt: "2026-11-10T18:30:00.000Z",
            members: [
              {
                id: "student-1",
                nickname: "Maya BuildLead",
                legalName: "Maya Lin",
                role: "member",
                memberType: "student",
                tshirtSize: "M",
                dietaryRestrictions: ["Vegetarian"],
                emergencyContactName: "Jordan Lin",
                emergencyContactPhone: "304-555-0199",
                firstConsentVerified: true,
              },
            ],
          }),
        });
      },
    );

    await loginAs("coach");
    await page.goto("/dashboard/users");
    await page
      .getByRole("button", { name: "Travel & Safety Readiness" })
      .click();

    await expect(
      page.getByRole("heading", {
        name: /Travel, Safety & FIRST® Consent Readiness/i,
      }),
    ).toBeVisible();
    await expect(page.getByText("M: 1")).toBeVisible();
    await expect(page.getByText("Vegetarian (1)")).toBeVisible();

    await page
      .getByRole("button", { name: "Reveal & Print Emergency Travel Binder" })
      .click();
    await expect(page.getByText("304-555-0199")).toBeVisible();
    expect(revealAuditReason).toBe("Coach tournament travel binder");
  });

  test("Phase 3: Engineering Portfolio & 7-Award Evidence Hub storyboard and save flow", async ({
    page,
    context,
    loginAs,
  }) => {
    await context.route("https://firestore.googleapis.com/**", (route) =>
      route.abort("blockedbyclient"),
    );
    await page.addInitScript(() => {
      window.print = () => undefined;
    });

    const pagesFixture = Array.from({ length: 15 }, (_, index) => ({
      pageNumber: index + 1,
      title: index === 0 ? "Executive Team & Robot Summary" : `Page ${index + 1}`,
      section: index === 0 ? "cover" : "hardware_cad",
      status: index === 0 ? "verified" : "drafting",
      ownerNickname: index === 0 ? "Maya" : "",
      summaryNotes: index === 0 ? "Backed by CAD & Studio logs." : "",
      linkedArtifactIds: index === 0 ? ["robot:hephaestus"] : [],
    }));

    const awardsFixture = [
      {
        awardId: "inspire",
        name: "Inspire Award",
        criteria: "Overall excellence across engineering, outreach, and sustainability.",
        claimSummary: "Full CAD + open Academy curriculum.",
        linkedArtifactIds: ["robot:hephaestus"],
        verifiedArtifactCount: 1,
        needsEvidence: false,
      },
      {
        awardId: "control",
        name: "Control Award",
        criteria: "Sensors, kinematics, and autonomous reliability.",
        claimSummary: "",
        linkedArtifactIds: [],
        verifiedArtifactCount: 0,
        needsEvidence: true,
        controlSheet: {
          autonomousRoutines: "4-specimen high basket trajectory",
          sensorsUsed: "Pinpoint odometry + Limelight 3A",
          algorithmsSummary: "Action-based cached-IO feedforward loop",
        },
      },
    ];

    let savedSeasonPut = false;
    await page.route("**/api/content-admin/portfolio/2026-2027", async (route) => {
      if (route.request().method() === "PUT") {
        savedSeasonPut = true;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          seasonKey: "2026-2027",
          workspace: {
            awards: awardsFixture,
            pages: pagesFixture,
            updatedAt: "2026-11-10T19:00:00.000Z",
            updatedByNickname: "Playwright coach",
          },
          candidates: [
            {
              id: "robot:hephaestus",
              kind: "robot",
              title: "Hephaestus (2026-2027)",
              subtitle: "Mecanum • Kotlin ARESLib",
              date: "2026-10-01",
              href: "/robots/hephaestus",
            },
          ],
        }),
      });
    });

    await loginAs("coach");
    await page.goto("/dashboard/portfolio");

    await expect(
      page.getByRole("heading", {
        name: "Engineering Portfolio & Award Evidence Hub",
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Inspire Award", level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Control Award", level: 2 }),
    ).toBeVisible();

    await page
      .getByRole("tab", { name: "15-Page Portfolio Storyboard" })
      .click();
    await expect(
      page.locator('input[value="Executive Team & Robot Summary"]'),
    ).toBeVisible();

    await page.getByRole("button", { name: "Save Workspace" }).click();
    await expect(
      page.getByText("Portfolio workspace saved and verified against live artifacts."),
    ).toBeVisible();
    expect(savedSeasonPut).toBe(true);
  });

  test("Phase 4a: Public Season Dossiers and signed-out Competition Hub", async ({
    page,
    context,
  }) => {
    await context.route("https://firestore.googleapis.com/**", (route) =>
      route.abort("blockedbyclient"),
    );

    await page.route("**/api/seasons", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          seasons: [
            {
              id: "decode-2026",
              startYear: 2026,
              endYear: 2027,
              challengeName: "DECODE",
              summary: "High-speed autonomous artifact decoding.",
              robotName: "Hephaestus",
              robotId: "hephaestus",
              status: "published",
            },
          ],
        }),
      });
    });

    await page.route("**/api/tournaments/public/results*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          results: [
            {
              id: "wv-champs",
              name: "WV State Championship",
              date: "2026-11-21",
              location: "Fairmont, WV",
              description: "Undefeated qualification run and Inspire Award 1st Place.",
              seasonName: "2026-2027",
              challengeName: "DECODE",
              status: "past",
              opr: 94.2,
              rank: 1,
              record: { wins: 6, losses: 0, ties: 0 },
            },
          ],
        }),
      });
    });

    await page.route("**/api/awards", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          awards: [
            {
              id: "aw-1",
              title: "Inspire Award 1st Place",
              eventName: "WV State Championship",
              date: "2026-11-21",
              iconType: "trophy",
              seasonId: "decode-2026",
              status: "published",
            },
          ],
        }),
      });
    });

    await page.goto("/seasons");
    await expect(page.getByText("DECODE").first()).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("link", { name: /Hephaestus/i }).first(),
    ).toHaveAttribute("href", "/robots/hephaestus");

    await page.goto("/tournaments");
    await expect(page.getByText("WV State Championship")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("6-0-0", { exact: true })).toBeVisible();
  });

  test("Phase 4b: Printable Sponsor Fact Sheet and Robot Pit Technical Sheet QR dossiers", async ({
    page,
    context,
  }) => {
    await context.route("https://firestore.googleapis.com/**", (route) =>
      route.abort("blockedbyclient"),
    );
    await page.addInitScript(() => {
      window.print = () => undefined;
    });

    await page.route("**/api/seasons", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          seasons: [
            {
              id: "decode-2026",
              startYear: 2026,
              endYear: 2027,
              challengeName: "DECODE",
              status: "published",
            },
          ],
        }),
      });
    });

    await page.route("**/api/photos/public/sponsor-logo/zulip", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    });

    await page.route("**/api/sponsors", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sponsors: [
            {
              name: "Mountaineer Precision Labs",
              tier: "Gold",
              websiteUrl: "https://example.org",
            },
            {
              name: "Zulip",
              tier: "In-Kind",
              logoUrl: "/api/photos/public/sponsor-logo/zulip",
              websiteUrl: "https://zulip.com/",
            },
          ],
        }),
      });
    });

    await page.route("**/api/outreach*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          logs: [{ id: "out-1", title: "STEM Night", hours: 12, peopleReached: 180 }],
          nextCursor: null,
        }),
      });
    });

    await page.route("**/api/awards", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          awards: [
            {
              id: "aw-1",
              title: "Inspire Award 1st Place",
              eventName: "WV State Championship",
              date: "2026-11-21",
              iconType: "trophy",
              seasonId: "decode-2026",
              status: "published",
            },
          ],
        }),
      });
    });

    await page.route("**/api/robots/hephaestus", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          robot: {
            id: "hephaestus",
            name: "Hephaestus",
            seasonName: "2026-2027",
            challengeName: "DECODE",
            drivetrainType: "Custom Coaxial Swerve",
            primaryMechanism: "Dual-Stage Linear Turret",
            programmingLanguage: "Kotlin (ARESLib 20)",
            weightLbs: 38.4,
            content: "CNC billet pod chassis with Pinpoint dead-wheel fusion.",
          },
        }),
      });
    });

    await page.goto("/sponsors");
    const zulipLogo = page.getByRole("img", { name: "Zulip logo" });
    await expect(zulipLogo).toBeVisible();
    await expect
      .poll(async () =>
        zulipLogo.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
      )
      .toBe(true);
    await page
      .getByRole("button", { name: "Printable Team & Sponsor Fact Sheet" })
      .click();
    const sponsorSheet = page.getByRole("region", {
      name: "Printable Team and Sponsorship Fact Sheet",
    });
    await expect(
      sponsorSheet.getByRole("img", {
        name: "QR code for ARES 23247 sponsorship page",
      }),
    ).toBeVisible();
    await expect(sponsorSheet.getByText("180", { exact: true })).toBeVisible();

    await page.goto("/robots/hephaestus");
    await page.getByRole("button", { name: "Judge / Pit Sheet" }).click();
    const pitSheet = page.getByRole("region", {
      name: "Printable Judge and Pit Technical Sheet",
    });
    await expect(
      pitSheet.getByRole("img", {
        name: "QR code for Hephaestus technical dossier",
      }),
    ).toBeVisible();
    await expect(
      pitSheet.getByText("aresfirst.org/robots/hephaestus"),
    ).toBeVisible();
  });
});
