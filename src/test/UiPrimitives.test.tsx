import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AsyncState } from "@/components/ui/AsyncState";
import { Badge } from "@/components/ui/Badge";
import {
  Button,
  IconButton,
  buttonClassName,
} from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { ConfirmDialog, DialogShell, Drawer } from "@/components/ui/Dialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableFrame } from "@/components/ui/TableFrame";
import DocumentConnectionBadge from "@/components/dashboard/DocumentConnectionBadge";

describe("shared UI primitives", () => {
  it("provides a consistent page heading and optional action region", () => {
    render(
      <PageHeader
        eyebrow="Team media"
        title="Manage videos"
        description="Review the official team channel."
        actions={<Button>Add video</Button>}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Manage videos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Team media")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add video" })).toBeInTheDocument();
  });

  it("gives horizontally scrollable data tables an accessible caption", () => {
    render(
      <TableFrame caption="Team members" className="min-w-[40rem]">
        <thead><tr><th>Name</th></tr></thead>
        <tbody><tr><td>Alex</td></tr></tbody>
      </TableFrame>,
    );

    expect(screen.getByRole("table", { name: "Team members" })).toHaveClass(
      "min-w-[40rem]",
    );
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
  });

  it("provides native button behavior, variants, and pending semantics", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Button onClick={onClick} variant="gold" className="w-full">
        Save
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("w-full", "text-ares-gold");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();

    rerender(
      <Button isPending pendingLabel="Saving">
        Save
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Saving" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(buttonClassName({ variant: "danger", size: "lg" })).toContain(
      "bg-ares-red/15",
    );
  });

  it("requires an accessible name for icon-only controls", () => {
    render(
      <IconButton aria-label="Close panel" variant="ghost">
        <span aria-hidden="true">×</span>
      </IconButton>,
    );

    expect(screen.getByRole("button", { name: "Close panel" })).toHaveClass(
      "min-h-11",
      "min-w-11",
    );
  });

  it("associates labels, help, errors, and required state with controls", () => {
    render(
      <Field
        id="team-name"
        label="Team name"
        description="Use the official name."
        error="A name is required."
        required
      >
        <Input placeholder="ARES" aria-describedby="external-help" />
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Team name" });
    expect(input).toHaveAttribute("id", "team-name");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain("external-help");
    expect(input.getAttribute("aria-describedby")).toContain("team-name-description");
    expect(input.getAttribute("aria-describedby")).toContain("team-name-error");
    expect(screen.getByRole("alert")).toHaveTextContent("A name is required.");
  });

  it("supports select and textarea controls inside or outside a field", () => {
    render(
      <>
        <Field label="Audience">
          <Select defaultValue="students">
            <option value="students">Students</option>
          </Select>
        </Field>
        <Textarea aria-label="Notes" aria-invalid="false" required />
      </>,
    );

    expect(screen.getByRole("combobox", { name: "Audience" })).toHaveAttribute("id");
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveAttribute(
      "aria-invalid",
      "false",
    );
    expect(screen.getByRole("textbox", { name: "Notes" })).toBeRequired();
  });

  it("keeps decorative badges quiet and announces changing status badges", () => {
    const { rerender } = render(<Badge variant="neutral">Draft</Badge>);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Draft")).toHaveClass("text-marble/80");

    rerender(<Badge announce variant="success">Published</Badge>);
    expect(screen.getByRole("status")).toHaveTextContent("Published");

    rerender(<DocumentConnectionBadge state="error" />);
    expect(screen.getByRole("status")).toHaveTextContent("Sync Error");
  });

  it("uses assertive errors and polite non-error async states", () => {
    const { rerender } = render(
      <AsyncState variant="loading" title="Loading records" message="Please wait." />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");

    rerender(
      <AsyncState
        variant="error"
        title="Could not load records"
        action={<Button>Try again</Button>}
      >
        <p>Diagnostic code: unavailable</p>
      </AsyncState>,
    );
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();

    rerender(<AsyncState variant="success" title="Saved" titleAs="p" />);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("labels centered dialogs and restores close actions through Radix", () => {
    const onOpenChange = vi.fn();
    render(
      <DialogShell
        open
        onOpenChange={onOpenChange}
        title="Edit record"
        description="Update the current record."
        size="lg"
      >
        <Input aria-label="Record name" />
      </DialogShell>,
    );

    expect(screen.getByRole("dialog", { name: "Edit record" })).toHaveTextContent(
      "Update the current record.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("provides a mobile-height drawer using the same dialog semantics", () => {
    render(
      <Drawer
        open
        onOpenChange={() => undefined}
        title="Filters"
        description="Choose visible records."
        size="sm"
        layer="raised"
      >
        <p>Filter controls</p>
      </Drawer>,
    );

    expect(screen.getByRole("dialog", { name: "Filters" })).toHaveClass(
      "right-0",
      "h-dvh",
      "z-[131]",
    );
  });

  it("focuses the safe confirmation action and blocks dismissal while busy", async () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Archive this record?"
        description="You can restore it later."
        confirmLabel="Archive"
        pendingLabel="Archiving"
        onConfirm={onConfirm}
        layer="nested"
      />,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <ConfirmDialog
        open
        busy
        onOpenChange={onOpenChange}
        title="Archive this record?"
        description="You can restore it later."
        confirmLabel="Archive"
        pendingLabel="Archiving"
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByRole("button", { name: "Archiving" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
