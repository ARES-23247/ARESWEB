import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DocFormDrawer from "@/components/dashboard/DocFormDrawer";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "member-1", displayName: "Member" },
    authorizedUser: { name: "Member", role: "mentor" },
  }),
  useOptionalAuth: () => undefined,
}));

vi.mock("@/components/dashboard/DocFormMainFields", () => ({
  default: (props: {
    draft: { title: string; slug: string };
    onChange: (field: "title" | "slug", value: string) => void;
    onSubmit: (event: React.FormEvent) => void;
  }) => (
    <form id="docForm" data-testid="doc-form" onSubmit={props.onSubmit}>
      <label htmlFor="test-title">Title</label>
      <input
        id="test-title"
        value={props.draft.title}
        onChange={(event) => props.onChange("title", event.target.value)}
      />
      <label htmlFor="test-slug">Slug</label>
      <input
        id="test-slug"
        value={props.draft.slug}
        onChange={(event) => props.onChange("slug", event.target.value)}
      />
    </form>
  ),
}));

vi.mock("@/components/dashboard/DocFormDrawerAiCopilot", () => ({
  default: () => null,
}));
vi.mock("@/components/PhotoPickerModal", () => ({ default: () => null }));
vi.mock("@/components/RevisionHistoryTable", () => ({
  default: () => <div>Revision history</div>,
}));

const baseProps = {
  isOpen: true,
  editDoc: null,
  categories: ["guide"],
  defaultCategory: "guide",
  variant: "documents" as const,
  revisions: [],
  loadingRevisions: false,
  fetchRevisions: vi.fn(() => Promise.resolve()),
};

describe("DocFormDrawer", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes modal semantics and makes the dashboard background inert", async () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <>
        <main data-testid="dashboard-background">Dashboard</main>
        <DocFormDrawer
          {...baseProps}
          onClose={onClose}
          onSave={vi.fn(() => Promise.resolve())}
        />
      </>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Create New Document");
    await waitFor(() =>
      expect(
        screen.getByTestId("dashboard-background").closest("div"),
      ).toHaveAttribute("aria-hidden", "true"),
    );

    const backgroundContainer = screen
      .getByTestId("dashboard-background")
      .closest("div") as HTMLElement;
    expect(backgroundContainer.inert).toBe(true);
    unmount();
    expect(backgroundContainer.inert).not.toBe(true);
    expect(backgroundContainer).not.toHaveAttribute("aria-hidden");
  });

  it("uses an accessible inline choice for dirty close and preserves a complete recovery draft", async () => {
    vi.useFakeTimers();
    const confirmSpy = vi.spyOn(window, "confirm");
    const onClose = vi.fn();
    render(
      <DocFormDrawer
        {...baseProps}
        onClose={onClose}
        onSave={vi.fn(() => Promise.resolve())}
      />,
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Recovered manual" },
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(
      window.localStorage.getItem("ares-editor-draft:documents:new"),
    ).toContain("Recovered manual");

    fireEvent.click(screen.getByRole("button", { name: "Close editor" }));
    const closePrompt = screen.getByRole("alertdialog", {
      name: "Close with unsaved changes?",
    });
    expect(closePrompt).toBeVisible();
    expect(screen.getByRole("button", { name: "Keep Editing" })).toHaveFocus();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Keep Editing" }));
    expect(
      screen.queryByRole("alertdialog", {
        name: "Close with unsaved changes?",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close editor" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Close editor" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Close and Keep Draft" }),
    );
    expect(onClose).toHaveBeenCalledOnce();
    expect(
      window.localStorage.getItem("ares-editor-draft:documents:new"),
    ).toContain("Recovered manual");
  });

  it("preserves an unsaved draft when the same remote document refreshes", () => {
    const editDoc = {
      slug: "inspection-guide",
      title: "Inspection guide",
    } as NonNullable<React.ComponentProps<typeof DocFormDrawer>["editDoc"]>;
    const props = {
      ...baseProps,
      editDoc,
      onClose: vi.fn(),
      onSave: vi.fn(() => Promise.resolve()),
    };
    const { rerender } = render(<DocFormDrawer {...props} />);

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Unsaved inspection edits" },
    });
    rerender(
      <DocFormDrawer
        {...props}
        editDoc={{ ...editDoc, title: "Remote snapshot title" }}
      />,
    );

    expect(screen.getByLabelText("Title")).toHaveValue(
      "Unsaved inspection edits",
    );
  });

  it("offers keyboard-focused recovery choices before applying a local draft", async () => {
    window.localStorage.setItem(
      "ares-editor-draft:documents:new",
      JSON.stringify({
        title: "Recovered inspection guide",
        slug: "recovered-inspection-guide",
        content: "Unsaved inspection notes",
      }),
    );
    const onClose = vi.fn();
    render(
      <DocFormDrawer
        {...baseProps}
        onClose={onClose}
        onSave={vi.fn(() => Promise.resolve())}
      />,
    );

    const recoveryPrompt = await screen.findByRole("alertdialog", {
      name: "Local recovery draft available",
    });
    expect(recoveryPrompt).toBeVisible();
    expect(screen.getByLabelText("Title")).toHaveValue("");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Restore Draft" }),
      ).toHaveFocus(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore Draft" }));
    expect(screen.getByLabelText("Title")).toHaveValue(
      "Recovered inspection guide",
    );
    expect(screen.getByText(/Recovered an unsaved local draft/)).toBeVisible();
    expect(
      screen.queryByRole("alertdialog", {
        name: "Local recovery draft available",
      }),
    ).not.toBeInTheDocument();
  });

  it("discards a recovery draft only after the explicit inline choice", async () => {
    window.localStorage.setItem(
      "ares-editor-draft:documents:new",
      JSON.stringify({ title: "Old draft" }),
    );
    render(
      <DocFormDrawer
        {...baseProps}
        onClose={vi.fn()}
        onSave={vi.fn(() => Promise.resolve())}
      />,
    );

    await screen.findByRole("alertdialog", {
      name: "Local recovery draft available",
    });
    fireEvent.click(screen.getByRole("button", { name: "Discard Draft" }));

    expect(
      window.localStorage.getItem("ares-editor-draft:documents:new"),
    ).toBeNull();
    expect(
      screen.queryByRole("alertdialog", {
        name: "Local recovery draft available",
      }),
    ).not.toBeInTheDocument();
  });

  it("locks submission while a save is in progress", async () => {
    let resolveSave: (() => void) | undefined;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const onClose = vi.fn();
    render(<DocFormDrawer {...baseProps} onClose={onClose} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Safety manual" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Slug")).toHaveValue("safety-manual"),
    );
    fireEvent.submit(screen.getByTestId("doc-form"));

    const savingButton = await screen.findByRole("button", {
      name: "Saving...",
    });
    expect(savingButton).toBeDisabled();
    fireEvent.click(savingButton);
    expect(onSave).toHaveBeenCalledOnce();

    await act(async () => resolveSave?.());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("previews the current unsaved draft without saving it", async () => {
    const onSave = vi.fn(() => Promise.resolve());
    render(<DocFormDrawer {...baseProps} onClose={vi.fn()} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Mobile inspection guide" },
    });
    await waitFor(() => expect(screen.getByLabelText("Slug")).toHaveValue("mobile-inspection-guide"));
    fireEvent.click(screen.getByRole("button", { name: /Preview Draft/i }));

    expect(screen.getByRole("heading", { name: "Mobile inspection guide" })).toBeInTheDocument();
    expect(screen.getByText("Preview only · return to Compose Content to make changes")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
