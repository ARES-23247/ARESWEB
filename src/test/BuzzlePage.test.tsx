import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/buzzleDictionary", () => ({
  loadBuzzleDictionary: async () => ({ words: new Set(["at", "ate", "cat", "bee"]) }),
}));

import BuzzlePage from "@/app/buzzle/page";

describe("BUZZLE page", () => {
  it("renders the complete keyboard-operable hive and starts pass-and-play", async () => {
    render(<BuzzlePage />);
    fireEvent.click(screen.getByRole("button", { name: /Pass & Play/u }));
    expect(screen.getByRole("heading", { level: 1, name: "BUZZLE™" })).toBeInTheDocument();
    expect(screen.getAllByRole("gridcell")).toHaveLength(217);
    expect(screen.getByRole("grid", { name: /BUZZLE board/u })).toBeInTheDocument();
    const rack = screen.getByRole("list", { name: /Player 1 tiles/u });
    expect(within(rack).getAllByRole("listitem")).toHaveLength(7);
    expect(rack.querySelectorAll("img")).toHaveLength(0);
    expect(rack.querySelectorAll(".buzzle-tile-face")).toHaveLength(7);
    expect(rack.querySelectorAll(".buzzle-tile-points")).toHaveLength(7);
    await waitFor(() => expect(screen.getByText(/255,472 filtered English words ready/u)).toBeInTheDocument());
  });

  it("supports four local players and exposes the chat-free online choices", async () => {
    render(<BuzzlePage />);
    fireEvent.change(screen.getByLabelText("Local players"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: /Pass & Play/u }));
    expect(screen.getByLabelText("Player scores").children).toHaveLength(4);

    fireEvent.click(screen.getByRole("button", { name: "New game" }));
    fireEvent.click(screen.getByRole("button", { name: /^Online/u }));
    expect(screen.getByRole("dialog", { name: "Online BUZZLE" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Find a guest/u })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Team matchmaking/u })).toBeInTheDocument();
    expect(screen.getByText(/no chat, profiles, or permanent room history/u)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Dictionary: loading/u)).not.toBeInTheDocument());
  });

  it("declares a winner, shows game over dialog, and updates scoreboard when match finishes", async () => {
    render(<BuzzlePage />);
    fireEvent.click(screen.getByRole("button", { name: /Pass & Play/u }));

    // Execute 6 consecutive passes to trigger game finish (3 full rounds of passes in a 2-player game)
    for (let i = 0; i < 6; i += 1) {
      if (i > 0) {
        fireEvent.click(screen.getByRole("button", { name: "Reveal my rack" }));
      }
      fireEvent.click(screen.getByRole("button", { name: "Pass" }));
    }

    // Game over dialog should be open declaring winner or draw
    expect(await screen.findByRole("dialog", { name: /Wins!|The Hive is Balanced/u })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review board" })).toBeInTheDocument();

    // Review board to inspect match complete UI
    fireEvent.click(screen.getByRole("button", { name: "Review board" }));
    expect(screen.getByRole("heading", { level: 2, name: "Match Complete" })).toBeInTheDocument();
    expect(screen.getByText(/Game over ·/u)).toBeInTheDocument();

    // Scoreboard should show winner/tie indicator
    expect(screen.getAllByRole("status").some((node) => /Winner|Tie/u.test(node.textContent ?? ""))).toBe(true);

    // Action panel should offer View results and Rematch
    expect(screen.getByRole("button", { name: "View results" })).toBeInTheDocument();
    const rematchButton = screen.getByRole("button", { name: "Rematch" });
    expect(rematchButton).toBeInTheDocument();

    // Reopen results dialog
    fireEvent.click(screen.getByRole("button", { name: "View results" }));
    expect(screen.getByRole("dialog", { name: /Wins!|The Hive is Balanced/u })).toBeInTheDocument();

    // Start rematch
    fireEvent.click(screen.getAllByRole("button", { name: "Rematch" })[0]!);
    expect(screen.getByRole("heading", { level: 2, name: "Tournament hive" })).toBeInTheDocument();
  });
});
