import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DocsSidebar from "@/components/docs/DocsSidebar";
import { useSidebarStore } from "@/store/sidebarStore";

describe("DocsSidebar mobile accessibility", () => {
  beforeEach(() => {
    useSidebarStore.getState().setDocsOpen(false);
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: false,
      media: "(min-width: 1024px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("only exposes modal semantics while open and restores focus on Escape", async () => {
    render(
      <MemoryRouter>
        <div>
          <DocsSidebar
            groupedDocs={[]}
            searchQuery=""
            onSearchQueryChange={vi.fn()}
            onSearchOpen={vi.fn()}
            basePath="/academy"
          />
          <main data-testid="lesson-content">Lesson content</main>
        </div>
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", {
      name: "Open documentation navigation",
    });
    const sidebar = document.getElementById("documentation-sidebar");
    expect(sidebar).toHaveAttribute("aria-hidden", "true");
    expect(sidebar).not.toHaveAttribute("role", "dialog");

    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", {
      name: "Documentation navigation",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("lesson-content")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByTestId("lesson-content")).toHaveProperty("inert", true);
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
    expect(screen.getByTestId("lesson-content")).not.toHaveAttribute(
      "aria-hidden",
    );
    expect(screen.getByTestId("lesson-content")).not.toHaveProperty(
      "inert",
      true,
    );
  });
});
