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
    expect(screen.getAllByRole("gridcell")).toHaveLength(127);
    expect(screen.getByRole("grid", { name: /BUZZLE board/u })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: /Player 1 tiles/u })).getAllByRole("listitem")).toHaveLength(7);
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
});
