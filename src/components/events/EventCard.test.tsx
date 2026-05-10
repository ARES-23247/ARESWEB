import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EventCard, EventItem } from "./EventCard";
import * as calendarUtils from "../../utils/calendar";

// Mock @tanstack/react-router Link
vi.mock("@tanstack/react-router", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Link: ({ children, to, params, className }: any) => {
    let href = to;
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        href = href.replace(`$${key}`, value as string);
      });
    }
    return <a href={href} className={className}>{children}</a>;
  }
}));

// Mock the downloadICS utility
vi.mock("../../utils/calendar", () => ({
  downloadICS: vi.fn(),
}));

const mockEvent: EventItem = {
  id: "test-event-1",
  title: "Championship Celebration",
  dateStart: "2026-05-15T18:00:00Z",
  dateEnd: "2026-05-15T21:00:00Z",
  location: "ARES Lab",
  description: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Join us for a celebration of our championship win!"}]}]}',
  coverImage: null,
  tbaEventKey: null,
  category: "internal",
};

describe("EventCard Component", () => {
  const renderCard = (event: EventItem, isPast = false) => {
    return render(
      <EventCard event={event} isPast={isPast} />
    );
  };

  it("renders the event title and location correctly", () => {
    renderCard(mockEvent);
    expect(screen.getByText("Championship Celebration")).toBeInTheDocument();
    expect(screen.getByText(/ARES Lab/)).toBeInTheDocument();
  });

  it("parses and displays the description from Tiptap AST", () => {
    renderCard(mockEvent);
    expect(screen.getByText("Join us for a celebration of our championship win!")).toBeInTheDocument();
  });

  it("formats the date correctly", () => {
    renderCard(mockEvent);
    // 15th of May (May is MMM)
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("May")).toBeInTheDocument();
  });

  it("shows 'View Details' for future events", () => {
    renderCard(mockEvent, false);
    expect(screen.getByText("View Details")).toBeInTheDocument();
  });

  it("shows 'Read Recap' for past events", () => {
    renderCard(mockEvent, true);
    expect(screen.getByText("Read Recap")).toBeInTheDocument();
  });

  it("triggers downloadICS when the 'Add to Calendar' button is clicked", () => {
    renderCard(mockEvent, false);
    const calendarBtn = screen.getByLabelText(`Add ${mockEvent.title} to calendar`);
    fireEvent.click(calendarBtn);
    expect(calendarUtils.downloadICS).toHaveBeenCalledWith(mockEvent);
  });

  it("hides the calendar button for past events", () => {
    renderCard(mockEvent, true);
    const calendarBtn = screen.queryByLabelText(`Add ${mockEvent.title} to calendar`);
    expect(calendarBtn).not.toBeInTheDocument();
  });

  it("applies correct category indicator colors", () => {
    const { container } = renderCard(mockEvent);
    // internal category -> bg-ares-red
    const indicator = container.querySelector(".bg-ares-red");
    expect(indicator).toBeInTheDocument();
  });
});


