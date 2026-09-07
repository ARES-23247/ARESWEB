import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => vi.unstubAllGlobals());

  function computerGame(level = "medium") {
    fireEvent.click(screen.getByRole("button", { name: "New game" }));
    fireEvent.change(screen.getByLabelText("Opponent"), {
      target: { value: "computer" },
    });
    fireEvent.change(screen.getByLabelText("Difficulty"), {
      target: { value: level },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start new game" }));
  }

  it("links the published physical board and offers three computer levels", () => {
    page();
    expect(
      screen.getByRole("link", { name: /3D print BUZZHEX on Printables/ }),
    ).toHaveAttribute(
      "href",
      "https://www.printables.com/model/1834842-buzzhex-11-x-11-hex-strategy-game-reuse-your-buzze",
    );
    computerGame("hard");
    expect(JSON.parse(localStorage.getItem(BUZZHEX_SAVE_KEY)!)).toMatchObject({
      mode: "computer",
      difficulty: "hard",
    });
    fireEvent.click(screen.getByRole("button", { name: "New game" }));
    expect(
      within(screen.getByLabelText("Difficulty"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Easy", "Medium", "Hard"]);
  });

  it("locks computer turns, reverses the whole turn after a swap, and rejects stale replies", async () => {
    const workers: {
      onmessage: ((event: { data: unknown }) => void) | null;
      postMessage: ReturnType<typeof vi.fn>;
      terminate: ReturnType<typeof vi.fn>;
    }[] = [];
    vi.stubGlobal(
      "Worker",
      class {
        onmessage = null;
        postMessage = vi.fn();
        terminate = vi.fn();
        constructor() {
          workers.push(this);
        }
      },
    );
    const view = page();
    computerGame();
    fireEvent.click(cell("F6"));
    expect(cell("F7")).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(cell("F7"));
    expect(cell("F7")).toBeInTheDocument();
    await waitFor(() => expect(workers).toHaveLength(1));
    act(() => workers[0].onmessage!({ data: { type: "swap" } }));
    expect(
      screen.getByRole("status", { name: "Current turn" }),
    ).toHaveTextContent("Player 1 · Yellow to move");
    fireEvent.click(
      screen.getByRole("button", { name: "Undo your last turn" }),
    );
    expect(cell("F6")).toBeInTheDocument();
    fireEvent.click(cell("A1"));
    await waitFor(() => expect(workers).toHaveLength(2));
    fireEvent.click(
      screen.getByRole("button", { name: "Undo your last turn" }),
    );
    act(() => workers[1].onmessage!({ data: { type: "place", index: 60 } }));
    expect(cell("A1")).toBeInTheDocument();
    expect(cell("F6")).toBeInTheDocument();
    expect(workers[1].terminate).toHaveBeenCalled();
    view.unmount();
    page();
    expect(
      screen.getByRole("button", { name: "Undo your last turn" }),
    ).toBeDisabled();
  });

  it("reports unavailable workers and allows retry and switching back to local play", async () => {
    const start = vi.fn();
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          start();
          throw new Error("unavailable");
        }
      },
    );
    page();
    computerGame("easy");
    fireEvent.click(cell("A1"));
    await screen.findByRole("button", { name: "Retry computer move" });
    expect(screen.getByRole("alert")).toHaveTextContent("could not choose");
    fireEvent.click(
      screen.getByRole("button", { name: "Retry computer move" }),
    );
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "New game" }));
    fireEvent.change(screen.getByLabelText("Opponent"), {
      target: { value: "local" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start new game" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(cell("A1"));
    expect(
      screen.getByRole("button", { name: "Swap colors" }),
    ).toBeInTheDocument();
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
