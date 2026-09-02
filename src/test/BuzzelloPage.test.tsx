import { fireEvent, render, screen, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import BuzzelloPage from "@/app/buzzello/page";
import {
  createBuzzelloInitialBoard,
  formatBuzzelloCoordinate,
  getBuzzelloLegalMoves,
} from "@/lib/buzzello";

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/buzzello"]}>
        <BuzzelloPage />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe("BUZZELLO page", () => {
  it("starts a local match, plays a legal move, and supports undo", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: /start a new buzzello match/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /pass & play/i }));

    const board = screen.getByRole("grid", { name: /BUZZELLO board/i });
    expect(within(board).getAllByRole("gridcell")).toHaveLength(61);
    expect(screen.getByText(/Yellow opens/i)).toBeInTheDocument();

    const openingMove = getBuzzelloLegalMoves(
      createBuzzelloInitialBoard(),
      "yellow",
    )[0];
    const cell = within(board).getByRole("gridcell", {
      name: new RegExp(
        `${formatBuzzelloCoordinate(openingMove.index)}: empty, legal move`,
        "i",
      ),
    });
    fireEvent.click(cell);

    expect(screen.getByText("Black to move.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /view 1 move/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo move" }));
    expect(screen.getByText(/Yellow opens/i)).toBeInTheDocument();
  });

  it("exposes keyboard grid navigation, rules, and an empty history state", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /pass & play/i }));

    const center = screen.getByRole("gridcell", {
      name: /q 0, r 0: open center, empty/i,
    });
    center.focus();
    fireEvent.keyDown(center, { key: "ArrowRight" });
    expect(document.activeElement).toHaveAccessibleName(
      /q 1, r 0: yellow piece/i,
    );
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Home" });
    expect(document.activeElement).toHaveAccessibleName(/q 0, r 0/i);

    fireEvent.click(screen.getByRole("button", { name: "Rules" }));
    expect(
      screen.getByRole("heading", { name: /how to play buzzello/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Place and flank/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));

    fireEvent.click(screen.getByRole("button", { name: "Open move history" }));
    expect(screen.getByText(/No moves yet/i)).toBeInTheDocument();
  });
});
