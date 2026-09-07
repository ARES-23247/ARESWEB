import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SupplyForm from "../../packages/waggle-way/src/ui/SupplyForm";
import {
  createBlankLevel,
  validateLevel,
  type ToolStock,
} from "@ares/waggle-way/level";

const stock: ToolStock = {
  id: "tools",
  kind: "dancer",
  dance: "left",
  count: 2,
  width: 1,
  height: 1,
  direction: 6,
  range: 2,
  strength: 3,
};
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("contextual workshop supply controls", () => {
  it("shows only dancer settings and changes heading controls immediately without applying the draft", () => {
    const level = createBlankLevel(7);
    const onApply = vi.fn();
    render(
      <SupplyForm
        level={level}
        stock={stock}
        onApply={onApply}
        onRemove={vi.fn()}
      />,
    );
    expect(
      screen.queryByLabelText("Starting direction"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Starting fan strength"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tool width")).not.toBeInTheDocument();
    change("Supply count", "");
    expect(screen.getByLabelText("Supply count")).toHaveValue(null);
    change("Supply count", "4");
    change("Dance type", "point");
    change("Starting direction", "2");
    change("Dance type", "reverse");
    expect(
      screen.queryByLabelText("Starting direction"),
    ).not.toBeInTheDocument();
    change("Dance type", "point");
    expect(screen.getByLabelText("Starting direction")).toHaveValue("2");
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply supply" }));
    const next = onApply.mock.calls[0][0];
    expect(next).toEqual({ ...stock, count: 4, dance: "point", direction: 2 });
    expect(validateLevel({ ...level, inventory: [next] }).inventory).toEqual([
      next,
    ]);
  });

  it("preserves inactive saved values and unsaved type edits while showing only shelter dimensions", () => {
    const { dance: _dance, ...template } = stock;
    const leaf: ToolStock = {
      ...template,
      kind: "shelter",
      width: 3,
      height: 2,
    };
    const onApply = vi.fn();
    render(
      <SupplyForm
        level={createBlankLevel(7)}
        stock={leaf}
        onApply={onApply}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Dance type")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Tool influence range"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Starting direction"),
    ).not.toBeInTheDocument();
    change("Tool width", "4");
    change("Tool type", "fan");
    change("Starting fan strength", "1");
    change("Tool influence range", "5");
    change("Tool type", "shelter");
    expect(screen.getByLabelText("Tool width")).toHaveValue(4);
    change("Tool type", "fan");
    expect(screen.getByLabelText("Starting fan strength")).toHaveValue("1");
    expect(screen.getByLabelText("Tool influence range")).toHaveValue(5);
    change("Tool type", "shelter");
    fireEvent.click(screen.getByRole("button", { name: "Apply supply" }));
    expect(onApply).toHaveBeenCalledWith({ ...leaf, width: 4 });
  });

  it("converts a wide shelter into a valid one-cell dancer without silently applying or removing it", () => {
    const { dance: _dance, ...template } = stock;
    const leaf: ToolStock = {
      ...template,
      kind: "shelter",
      width: 4,
      height: 3,
    };
    const level = createBlankLevel(7);
    const onApply = vi.fn();
    const onRemove = vi.fn();
    render(
      <SupplyForm
        level={level}
        stock={leaf}
        onApply={onApply}
        onRemove={onRemove}
      />,
    );
    change("Tool type", "dancer");
    change("Dance type", "right");
    expect(screen.queryByLabelText("Tool width")).not.toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply supply" }));
    const next = onApply.mock.calls[0][0];
    expect(next).toEqual({
      ...leaf,
      kind: "dancer",
      dance: "right",
      width: 1,
      height: 1,
    });
    expect(validateLevel({ ...level, inventory: [next] }).inventory).toEqual([
      next,
    ]);
    fireEvent.click(
      screen.getByRole("button", { name: "Remove supply tools" }),
    );
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onApply).toHaveBeenCalledOnce();
  });

  it("retains the editable release direction in version 6", () => {
    const onApply = vi.fn();
    render(
      <SupplyForm
        level={createBlankLevel(6)}
        stock={stock}
        onApply={onApply}
        onRemove={vi.fn()}
      />,
    );
    change("Starting direction", "4");
    fireEvent.click(screen.getByRole("button", { name: "Apply supply" }));
    expect(onApply).toHaveBeenCalledWith({ ...stock, direction: 4 });
  });

  it("keeps unsupported dancers out of the legacy tool picker", () => {
    const { dance: _dance, ...template } = stock;
    render(
      <SupplyForm
        level={createBlankLevel(5)}
        stock={{ ...template, kind: "perch" }}
        onApply={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("option", { name: "Dancing bee" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Starting direction")).toHaveValue("6");
  });
});
