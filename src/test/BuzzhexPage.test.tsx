import { fireEvent, render, screen, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BuzzhexPage from "@/app/buzzhex/page";
import { BUZZHEX_SAVE_KEY } from "@ares/buzzhex/rules";

function page() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <BuzzhexPage />
      </MemoryRouter>
    </HelmetProvider>,
  );
}
const cell = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`^${label}, empty`) });
describe("BUZZHEX page", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it("renders 121 cells, exact tile assets, opening swap, and undo", () => {
    page();
    expect(
      within(screen.getByRole("group", { name: /BUZZHEX board/ })).getAllByRole(
        "button",
      ),
    ).toHaveLength(121);
    expect(screen.getByAltText("Yellow Buzzello tile")).toHaveAttribute(
      "src",
      "/images/games/buzzhex/buzzello-tile-yellow.svg",
    );
    fireEvent.click(cell("C8"));
    expect(
      screen.getByRole("status", { name: "Current turn" }),
    ).toHaveTextContent("Player 2 · Yellow to move");
    fireEvent.click(screen.getByRole("button", { name: "Swap colors" }));
    expect(
      screen.getByRole("button", { name: "C8, Black, Player 2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Current turn" }),
    ).toHaveTextContent("Player 1 · Yellow to move");
    fireEvent.click(cell("D8"));
    fireEvent.click(screen.getByRole("button", { name: "Undo last action" }));
    expect(cell("D8")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo last action" }));
    expect(
      screen.getByRole("button", { name: "Swap colors" }),
    ).toBeInTheDocument();
  });
  it("restores a saved swap, edits names, and confirms a clean reset", () => {
    const view = page();
    fireEvent.click(cell("F6"));
    fireEvent.click(screen.getByRole("button", { name: "Swap colors" }));
    view.unmount();
    page();
    expect(
      screen.getByRole("status", { name: "Current turn" }),
    ).toHaveTextContent("Player 1 · Yellow to move");
    fireEvent.click(screen.getByRole("button", { name: "Edit player names" }));
    fireEvent.change(screen.getByLabelText("Player 1"), {
      target: { value: "Bee" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save names" }));
    expect(
      screen.getByRole("status", { name: "Current turn" }),
    ).toHaveTextContent("Bee · Yellow to move");
    fireEvent.click(screen.getByRole("button", { name: "New game" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep playing" }));
    expect(
      screen.queryByRole("button", { name: "Swap colors" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New game" }));
    fireEvent.click(screen.getByRole("button", { name: "Start new game" }));
    expect(cell("F6")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Current turn" }),
    ).toHaveTextContent("Bee · Black to move");
    expect(
      screen.getByRole("button", { name: "Undo last action" }),
    ).toBeDisabled();
  });
  it("supports keyboard moves, help, zoom, fullscreen and blocked storage", () => {
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("unavailable");
      });
    page();
    fireEvent.keyDown(cell("F6"), { key: "ArrowRight" });
    expect(cell("G6")).toHaveFocus();
    fireEvent.keyDown(cell("G6"), { key: "Enter" });
    expect(
      screen.getByRole("status", { name: "Game storage" }),
    ).toHaveTextContent("could not save");
    fireEvent.click(screen.getByRole("button", { name: "Rules" }));
    expect(
      screen.getByRole("dialog", { name: "How to play BUZZHEX" }),
    ).toHaveTextContent("tile stays black");
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(
      screen.getByRole("group", { name: /BUZZHEX board/ }).parentElement,
    ).toHaveAttribute("data-fit", "false");
    fireEvent.click(screen.getByRole("button", { name: "Fit board" }));
    fireEvent.click(screen.getByRole("button", { name: "Enter full screen" }));
    expect(screen.getByRole("main")).toHaveAttribute(
      "data-game-fullscreen",
      "true",
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("main")).not.toHaveAttribute(
      "data-game-fullscreen",
    );
    write.mockRestore();
  });
  it("recovers gracefully from an invalid saved game", () => {
    localStorage.setItem(BUZZHEX_SAVE_KEY, "corrupt");
    page();
    expect(
      screen.getByRole("status", { name: "Game storage" }),
    ).toHaveTextContent("could not be restored");
    expect(cell("A1")).toBeInTheDocument();
  });
});
