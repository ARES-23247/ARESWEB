import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PollenPage from "@/app/pollen/page";

vi.mock("@/components/SEO", () => ({ default: () => null }));

function setup() {
  render(<MemoryRouter><PollenPage /></MemoryRouter>);
  const frame = screen.getByTitle("Pollenator Pile-Up game") as HTMLIFrameElement;
  const reply = vi.spyOn(frame.contentWindow!, "postMessage");
  const send = (data: unknown, source: Window = frame.contentWindow!, origin = "null") => {
    act(() => { window.dispatchEvent(new MessageEvent("message", { data, source, origin })); });
  };
  return { frame, reply, send };
}

beforeEach(() => { localStorage.clear(); });

describe("Pollen public page and isolated score bridge", () => {
  it("needs no account and loads only its isolated game's saved score", () => {
    localStorage.setItem("pollen_appalachian_high_score", "75");
    const { frame, reply, send } = setup();
    expect(frame).toHaveAttribute("sandbox", "allow-scripts");
    send({ type: "pollen:load-score" }, window);
    send({ type: "pollen:load-score" }, frame.contentWindow!, "https://untrusted.example");
    expect(reply).not.toHaveBeenCalled();
    send({ type: "pollen:load-score" });
    expect(reply).toHaveBeenCalledWith({ type: "pollen:score", score: 75 }, "*");
    expect(screen.getByText(/No sign-in needed/)).toBeVisible();
  });
  it("only saves bounded numeric high scores and rejects other messages", () => {
    const { send } = setup();
    for (const score of [-1, 1.5, "500", 1_000_000_001, null]) send({ type: "pollen:save-score", score });
    send({ type: "unrelated", score: 900 });
    expect(localStorage.getItem("pollen_appalachian_high_score")).toBeNull();
    send({ type: "pollen:save-score", score: 100 });
    send({ type: "pollen:save-score", score: 50 });
    expect(localStorage.getItem("pollen_appalachian_high_score")).toBe("100");
  });
  it("reports unavailable storage without breaking the game", () => {
    const { send, reply } = setup();
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => { throw new Error("Blocked"); });
    send({ type: "pollen:load-score" });
    expect(screen.getByRole("status")).toHaveTextContent("Browser storage is unavailable");
    expect(reply).toHaveBeenCalledWith({ type: "pollen:score", score: 0 }, "*");
  });
});
