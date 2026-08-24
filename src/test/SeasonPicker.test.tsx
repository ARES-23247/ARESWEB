import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SeasonPicker from "@/components/SeasonPicker";
import { fetchPublicSeasons } from "@/lib/publicContentApi";

vi.mock("@/lib/publicContentApi", () => ({
  fetchPublicSeasons: vi.fn(),
}));

describe("SeasonPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sorts published API choices and reports the selected season", async () => {
    vi.mocked(fetchPublicSeasons).mockResolvedValue([
      { id: "old", startYear: 2025, endYear: 2026, challengeName: "DECODE", status: "published" },
      { id: "new", startYear: 2026, endYear: 2027, challengeName: "NEXT", status: "published" },
    ]);
    const onChange = vi.fn();

    render(<SeasonPicker value="" onChange={onChange} />);

    const select = await screen.findByRole("combobox", { name: "Linked Season" });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "-- No Season Link --",
      "NEXT 2026-2027",
      "DECODE 2025-2026",
    ]);
    fireEvent.change(select, { target: { value: "2026" } });
    expect(onChange).toHaveBeenCalledWith("2026");
  });

  it("preserves an explicit error state when the API is unavailable", async () => {
    vi.mocked(fetchPublicSeasons).mockRejectedValue(new Error("offline"));

    render(<SeasonPicker value="" onChange={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Season choices could not be loaded. Try again after reconnecting.",
    );
  });
});
