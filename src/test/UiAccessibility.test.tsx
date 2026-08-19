import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { MobileNavDrawer } from "../components/navigation/MobileNavDrawer";
import { SelectedEventPanel } from "../app/calendar/components/SelectedEventPanel";
import { SyncSubscriptionPanel } from "../app/calendar/components/SyncSubscriptionPanel";
import UserRosterTable, { UserAuth } from "../app/dashboard/users/components/UserRosterTable";

const renderInRouter = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("accessible navigation and calendar controls", () => {
  it("labels the mobile navigation as a modal dialog", () => {
    renderInRouter(
      <MobileNavDrawer
        isOpen
        onClose={vi.fn()}
        loading={false}
        isSignedIn={false}
        user={null}
        userRole="Pending Verification"
        userImage={null}
        hasPendingInquiries={false}
        logout={vi.fn()}
        loginWithGoogle={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Mobile navigation menu" })).toHaveAttribute("aria-modal", "true");
  });

  it("keeps the event edit button separate from the event details link", () => {
    const handleEdit = vi.fn();
    renderInRouter(
      <SelectedEventPanel
        selectedDate={new Date("2026-08-10T12:00:00")}
        selectedDayEvents={[
          {
            id: "event-1",
            title: "Drive Practice",
            dateStart: "2026-08-10T18:00:00",
            dateEnd: "2026-08-10T20:00:00",
            location: "MARS Laboratory",
            description: "Practice autonomous routes.",
            category: "internal",
          },
        ]}
        canEdit
        formatFullDate={() => "Monday, August 10, 2026"}
        formatEventTime={() => "6:00 PM"}
        handleOpenInlineCreate={vi.fn()}
        handleOpenInlineEdit={handleEdit}
      />,
    );

    const detailsLink = screen.getByRole("link", {
      name: "View event details for Drive Practice",
    });
    const editButton = screen.getByRole("button", {
      name: "Edit Drive Practice",
    });
    expect(detailsLink).not.toContainElement(editButton);

    fireEvent.click(editButton);
    expect(handleEdit).toHaveBeenCalledWith("event-1", undefined);
  });

  it("uses the parent event for recurring-instance details and edits", () => {
    const handleEdit = vi.fn();
    renderInRouter(
      <SelectedEventPanel
        selectedDate={new Date("2026-08-17T12:00:00")}
        selectedDayEvents={[
          {
            id: "weekly-1_2026-08-17",
            recurrenceOf: "weekly-1",
            occurrenceDate: "2026-08-17",
            title: "Recurring Practice",
            dateStart: "2026-08-17T18:00:00",
            category: "internal",
          },
        ]}
        canEdit
        formatFullDate={() => "Monday, August 17, 2026"}
        formatEventTime={() => "6:00 PM"}
        handleOpenInlineCreate={vi.fn()}
        handleOpenInlineEdit={handleEdit}
      />,
    );

    expect(
      screen.getByRole("link", {
        name: "View event details for Recurring Practice",
      }),
    ).toHaveAttribute("href", "/events/weekly-1?occurrence=2026-08-17");
    fireEvent.click(screen.getByRole("button", { name: "Edit Recurring Practice" }));
    expect(handleEdit).toHaveBeenCalledWith("weekly-1", "2026-08-17");
  });

  it("announces when the calendar feed URL has been copied", () => {
    render(
      <SyncSubscriptionPanel
        webcalUrl="webcal://aresfirst.org/api/calendar/feed"
        gcalUrl="https://calendar.google.com/calendar/render"
        copyStatus="copied"
        handleCopyFeedUrl={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Calendar feed URL copied to clipboard.");
    expect(screen.getByRole("button", { name: "Calendar feed URL copied" })).toBeInTheDocument();
  });
});

describe("accessible roster form controls", () => {
  const user: UserAuth = {
    id: "member-1",
    email: "member@example.com",
    role: "member",
    name: "Alex Member",
    isRegistered: true,
    avatar: "",
    subteams: ["Programming"],
    memberType: "student",
    profileExists: true,
    zulipAccount: null,
  };

  it("associates labels and names destructive/save actions", () => {
    const onRoleChange = vi.fn();
    render(
      <UserRosterTable
        filteredUsers={[user]}
        isLoading={false}
        editedRoles={{ "member-1": "mentor" }}
        editedMemberTypes={{}}
        savingRoles={{}}
        onRoleChange={onRoleChange}
        onMemberTypeChange={vi.fn()}
        onSaveRole={vi.fn()}
        onRemoveUser={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Member Type")).toHaveValue("student");
    expect(screen.getByLabelText("Portal Role")).toHaveValue("mentor");
    expect(
      screen.getByRole("button", {
        name: "Save role and member type changes for Alex Member",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Revoke roster access for Alex Member",
      }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Portal Role"), {
      target: { value: "admin" },
    });
    expect(onRoleChange).toHaveBeenCalledWith("member-1", "admin");
  });
});

describe("responsive and landmark regressions", () => {
  it("uses responsive simulation layouts and a reduced-motion fallback", () => {
    const neuralPlayground = readFileSync(resolve(process.cwd(), "src/sims/nn-playground/index.tsx"), "utf8");
    const simulationPlayground = readFileSync(
      resolve(process.cwd(), "src/components/SimulationPlayground.tsx"),
      "utf8",
    );
    const globalStyles = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    expect(neuralPlayground).toContain("grid grid-cols-1 xl:grid-cols-12");
    expect(simulationPlayground).toContain('isNarrowLayout ? "vertical" : "horizontal"');
    expect(globalStyles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("does not add nested main landmarks inside public page content", () => {
    const academyPage = readFileSync(resolve(process.cwd(), "src/app/academy/page.tsx"), "utf8");
    const accessibilityPage = readFileSync(resolve(process.cwd(), "src/app/accessibility/page.tsx"), "utf8");

    expect(academyPage).not.toMatch(/<main\b/);
    expect(accessibilityPage).not.toMatch(/<main\b/);
  });

  it("uses an accessible feedback dialog instead of browser alerts and prompts", () => {
    const academyPage = readFileSync(resolve(process.cwd(), "src/app/academy/page.tsx"), "utf8");

    expect(academyPage).not.toMatch(/\b(?:alert|prompt)\s*\(/);
    expect(academyPage).toContain('aria-labelledby="documentation-feedback-title"');
    expect(academyPage).toContain('htmlFor="documentation-feedback-comment"');
    expect(academyPage).toContain('role={feedbackMessage.type === "error" ? "alert" : "status"}');
  });

  it("marks join form outcomes as live status and alert regions", () => {
    const joinPage = readFileSync(resolve(process.cwd(), "src/app/join/page.tsx"), "utf8");

    expect(joinPage).toContain('role="status" aria-live="polite"');
    expect(joinPage).toContain('role="alert" aria-live="assertive"');
    expect(joinPage).toContain('aria-busy={submitStatus === "sending"}');
  });
});
