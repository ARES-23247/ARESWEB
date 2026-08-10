import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DocFormDrawer from "@/components/dashboard/DocFormDrawer";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "member-1", displayName: "Member" },
    authorizedUser: { name: "Member", role: "mentor" },
  }),
}));

vi.mock("@/components/dashboard/DocFormMainFields", () => ({
  default: (props: {
    formTitle: string;
    setFormTitle: (value: string) => void;
    formSlug: string;
    setFormSlug: (value: string) => void;
    onSubmit: (event: React.FormEvent) => void;
  }) => (
    <form id="docForm" data-testid="doc-form" onSubmit={props.onSubmit}>
      <label htmlFor="test-title">Title</label>
      <input id="test-title" value={props.formTitle} onChange={(event) => props.setFormTitle(event.target.value)} />
      <label htmlFor="test-slug">Slug</label>
      <input id="test-slug" value={props.formSlug} onChange={(event) => props.setFormSlug(event.target.value)} />
    </form>
  ),
}));

vi.mock("@/components/dashboard/DocFormDrawerAiCopilot", () => ({ default: () => null }));
vi.mock("@/components/PhotoPickerModal", () => ({ default: () => null }));
vi.mock("@/components/RevisionHistoryTable", () => ({ default: () => <div>Revision history</div> }));

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
        <DocFormDrawer {...baseProps} onClose={onClose} onSave={vi.fn(() => Promise.resolve())} />
      </>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Create New Document");
    await waitFor(() => expect(screen.getByTestId("dashboard-background").closest("div")).toHaveAttribute("aria-hidden", "true"));

    const backgroundContainer = screen.getByTestId("dashboard-background").closest("div") as HTMLElement;
    expect(backgroundContainer.inert).toBe(true);
    unmount();
    expect(backgroundContainer.inert).not.toBe(true);
    expect(backgroundContainer).not.toHaveAttribute("aria-hidden");
  });

  it("guards dirty close and persists a complete local recovery draft", async () => {
    vi.useFakeTimers();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onClose = vi.fn();
    render(<DocFormDrawer {...baseProps} onClose={onClose} onSave={vi.fn(() => Promise.resolve())} />);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Recovered manual" } });
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(window.localStorage.getItem("ares-editor-draft:documents:new")).toContain("Recovered manual");

    fireEvent.click(screen.getByRole("button", { name: "Close editor" }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Close editor" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("locks submission while a save is in progress", async () => {
    let resolveSave: (() => void) | undefined;
    const onSave = vi.fn(() => new Promise<void>((resolve) => { resolveSave = resolve; }));
    const onClose = vi.fn();
    render(<DocFormDrawer {...baseProps} onClose={onClose} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Safety manual" } });
    await waitFor(() => expect(screen.getByLabelText("Slug")).toHaveValue("safety-manual"));
    fireEvent.submit(screen.getByTestId("doc-form"));

    const savingButton = await screen.findByRole("button", { name: "Saving..." });
    expect(savingButton).toBeDisabled();
    fireEvent.click(savingButton);
    expect(onSave).toHaveBeenCalledOnce();

    await act(async () => resolveSave?.());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
