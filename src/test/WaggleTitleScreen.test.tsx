import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import Game from "../../packages/waggle-way/src/Game";
import { PROGRESS_KEY } from "@ares/waggle-way/progress";

beforeEach(() => localStorage.clear());

describe("Waggle Way title-to-play flow", () => {
  it("keeps unreadable results intact while allowing every practice garden", () => {
    localStorage.setItem(PROGRESS_KEY, "unreadable");
    render(<Game workshopLink={<a href="/waggle-way/builder">Workshop</a>} />);
    fireEvent.click(screen.getByRole("button", { name: "Play gardens" }));
    expect(screen.getByRole("alert")).toHaveTextContent("preserved");
    fireEvent.click(
      screen.getByRole("button", { name: "Choose practice garden" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Practice gardens" });
    expect(within(dialog).getAllByText("Saving unavailable")).toHaveLength(5);
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Watch the Spray/ }),
    );
    expect(
      screen.getByRole("heading", { name: "Watch the Spray" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Open hive" })).toBeEnabled();
    expect(localStorage.getItem(PROGRESS_KEY)).toBe("unreadable");
  });
  it("opens at a named title screen and moves focus into the unstarted garden", () => {
    render(<Game workshopLink={<a href="/waggle-way/builder">Workshop</a>} />);
    expect(
      screen.getByRole("region", { name: "Waggle Way title screen" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Waggle Way", level: 1 }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Open hive" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workshop" })).toHaveAttribute(
      "href",
      "/waggle-way/builder",
    );
    fireEvent.click(screen.getByRole("button", { name: "Play gardens" }));
    expect(
      screen.queryByRole("region", { name: "Waggle Way title screen" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "First Waggle", level: 2 }),
    ).toHaveFocus();
    expect(screen.getByRole("button", { name: "Open hive" })).toBeEnabled();
  });

  it("preserves fullscreen when moving from the title into play and restores page scrolling on exit", () => {
    const overflow = document.body.style.overflow;
    render(<Game workshopLink={<a href="/waggle-way/builder">Workshop</a>} />);
    fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));
    expect(
      screen.getByRole("region", { name: "Waggle Way title screen" }),
    ).toHaveAttribute("data-game-fullscreen", "true");
    fireEvent.click(screen.getByRole("button", { name: "Play gardens" }));
    expect(
      screen.getByRole("region", { name: "Waggle Way game window" }),
    ).toHaveAttribute("data-game-fullscreen", "true");
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
    expect(document.body.style.overflow).toBe(overflow);
  });
});
