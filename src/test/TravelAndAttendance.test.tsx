import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TravelReadinessPanel from "@/app/dashboard/users/components/TravelReadinessPanel";
import EventFormRoster from "@/app/dashboard/events/components/EventFormRoster";
import EventRsvps from "@/components/events/EventRsvps";
import { authenticatedFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock("@/lib/firebaseFirestore", () => ({
  db: {},
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  setDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
}));

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

describe("Phase 2 — Travel Readiness & Fast Lab Attendance UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders boolean travel readiness, toggles FIRST consent, and reveals audited emergency binder on demand", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(
        jsonResponse({
          members: [
            {
              id: "student_ada",
              nickname: "Ada",
              role: "member",
              memberType: "student",
              subteams: ["software"],
              tshirtSize: "m",
              dietaryRestrictions: ["Vegetarian"],
              hasEmergencyContact: true,
              firstConsentVerified: false,
              firstConsentUpdatedAt: "",
            },
          ],
          tshirtCounts: { m: 1 },
          dietaryCounts: { Vegetarian: 1 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          userId: "student_ada",
          firstConsentVerified: true,
          firstConsentUpdatedAt: "2026-11-10T18:00:00.000Z",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          packetGeneratedAt: "2026-11-10T18:05:00.000Z",
          members: [
            {
              id: "student_ada",
              nickname: "Ada",
              legalName: "Ada Lovelace",
              role: "member",
              memberType: "student",
              tshirtSize: "m",
              dietaryRestrictions: ["Vegetarian"],
              emergencyContactName: "Anne Byron",
              emergencyContactPhone: "304-555-0199",
              firstConsentVerified: true,
            },
          ],
        }),
      );

    render(<TravelReadinessPanel />);

    expect(await screen.findByText("Ada")).toBeInTheDocument();
    expect(screen.queryByText("304-555-0199")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Verify FIRST consent for Ada/i }));

    await waitFor(() => {
      expect(authenticatedFetch).toHaveBeenCalledWith(
        "/api/profiles/admin/users/student_ada/consent",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Reveal & Print Emergency Travel Binder/i }),
    );

    expect(await screen.findByText("304-555-0199")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Anne Byron")).toBeInTheDocument();
  });

  it("projects a 4-digit Lab PIN and executes 1-tap mentor roll call in EventFormRoster", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          code: "4829",
          expiresAt: "2026-11-10T20:00:00.000Z",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          userId: "student_alan",
          attended: true,
        }),
      );

    const setRevertAlert = vi.fn();

    render(
      <EventFormRoster
        editId="practice_nov10"
        signups={[]}
        isAdmin={false}
        canManageAttendance={true}
        formIsPotluck={0}
        formIsVolunteer={0}
        user={{ uid: "mentor_1" } as never}
        userNickname="CoachGrace"
        teamMembers={[
          { uid: "student_alan", nickname: "Alan", avatar: "" },
        ]}
        displayedMembers={[
          { uid: "student_alan", nickname: "Alan", avatar: "" },
        ]}
        setRevertAlert={setRevertAlert}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Generate 4-Digit Lab Code/i }),
    );
    expect(await screen.findByText("4829")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Mark Alan present/i }),
    );

    await waitFor(() => {
      expect(authenticatedFetch).toHaveBeenCalledWith(
        "/api/calendar/manage/practice_nov10/roll-call",
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });

  it("verifies student 4-digit Lab PIN check-in inside EventRsvps", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(
      jsonResponse({
        success: true,
        attended: true,
        nickname: "StudentKatherine",
      }),
    );

    render(
      <MemoryRouter>
        <EventRsvps
          event={{
            id: "practice_nov10_2026-11-10",
            title: "Tuesday Lab Session",
            dateStart: "2026-11-10T22:00:00.000Z",
            category: "internal",
          }}
          eventParentId="practice_nov10"
          isVerified={true}
          isAdmin={false}
          signups={[]}
          mySignup={null}
          userId="student_katherine"
          bringing=""
          setBringing={vi.fn()}
          notes=""
          setNotes={vi.fn()}
          prepHours={0}
          setPrepHours={vi.fn()}
          signupError={null}
          submittingRsvp={false}
          handleRsvpSubmit={vi.fn()}
          handleRsvpCancel={vi.fn()}
          handleToggleAttendance={vi.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Lab Check-In \(4-Digit PIN\)/i), {
      target: { value: "4829" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Check In$/i }));

    expect(await screen.findByText("Checked in present!")).toBeInTheDocument();
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/calendar/manage/practice_nov10/self-checkin",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
