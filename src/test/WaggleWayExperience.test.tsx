import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExperienceControls, {
  useWaggleExperience,
} from "../../packages/waggle-way/src/ui/ExperienceControls";

const KEY = "ares.waggle-way.preferences.v1";
function Harness() {
  const experience = useWaggleExperience();
  return <ExperienceControls experience={experience} />;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("optional game sound and motion", () => {
  it("starts quietly and saves motion without changing any game rules", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Enable gentle sound cues")).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Test sound", hidden: true }),
    ).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Reduce extra animation"));
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
      version: 1,
      sound: false,
      reducedMotion: true,
    });
  });

  it("restores valid preferences and keeps unsupported data intact", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, sound: true, reducedMotion: true }),
    );
    const view = render(<Harness />);
    expect(screen.getByLabelText("Reduce extra animation")).toBeChecked();
    view.unmount();
    localStorage.setItem(KEY, '{"version":99}');
    render(<Harness />);
    expect(screen.getByRole("alert", { hidden: true })).toHaveTextContent(
      "preserved",
    );
    fireEvent.click(screen.getByLabelText("Reduce extra animation"));
    expect(localStorage.getItem(KEY)).toBe('{"version":99}');
  });

  it("reports storage and audio failures while allowing session preferences", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    vi.stubGlobal("AudioContext", undefined);
    render(<Harness />);
    fireEvent.click(screen.getByLabelText("Enable gentle sound cues"));
    expect(screen.getByLabelText("Enable gentle sound cues")).toBeChecked();
    expect(screen.getByRole("alert", { hidden: true })).toHaveTextContent(
      "could not be saved",
    );
    await waitFor(() =>
      expect(screen.getByRole("status", { hidden: true })).toHaveTextContent(
        "Sound is unavailable",
      ),
    );
  });

  it("initializes audio only after opt-in and closes it when leaving", async () => {
    const gain = {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const oscillator = {
      type: "",
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(() => gain),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: null as null | (() => void),
    };
    const audio = {
      state: "running",
      currentTime: 0,
      destination: {},
      createOscillator: vi.fn(() => oscillator),
      createGain: vi.fn(() => gain),
      close: vi.fn(async () => undefined),
    };
    const Audio = vi.fn(function () {
      return audio;
    });
    vi.stubGlobal("AudioContext", Audio);
    const view = render(<Harness />);
    expect(Audio).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Enable gentle sound cues"));
    });
    expect(oscillator.start).toHaveBeenCalledOnce();
    oscillator.onended?.();
    expect(oscillator.disconnect).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByLabelText("Enable gentle sound cues"));
    expect(
      screen.getByRole("button", { name: "Test sound", hidden: true }),
    ).toBeDisabled();
    view.unmount();
    expect(audio.close).toHaveBeenCalledOnce();
  });
});
