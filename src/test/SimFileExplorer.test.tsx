import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SimFileExplorer } from "../components/editor/SimFileExplorer";

interface HarnessProps {
  initialFiles?: Record<string, string>;
  initialActiveFile?: string;
  readOnlyFiles?: string[];
}

function ExplorerHarness({
  initialFiles = { "src/main.ts": "const draft = true;", "notes.md": "Keep me" },
  initialActiveFile = "src/main.ts",
  readOnlyFiles = [],
}: HarnessProps) {
  const [files, setFiles] = useState(initialFiles);
  const [activeFile, setActiveFile] = useState(initialActiveFile);

  return (
    <>
      <SimFileExplorer
        files={files}
        activeFile={activeFile}
        setActiveFile={setActiveFile}
        setFiles={setFiles}
        readOnlyFiles={readOnlyFiles}
      />
      <output aria-label="Active file">{activeFile || "none"}</output>
      <output aria-label="File drafts">{JSON.stringify(files)}</output>
    </>
  );
}

describe("SimFileExplorer reliability", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.spyOn(window, "prompt").mockReturnValue(null);
  });

  it("labels every control and supports keyboard folder and file activation", () => {
    render(<ExplorerHarness />);

    expect(screen.getByRole("navigation", { name: "Simulation file explorer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create file" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create folder" })).toBeInTheDocument();

    const folder = screen.getByRole("button", { name: "Expand folder src" });
    expect(folder.tagName).toBe("BUTTON");
    fireEvent.click(folder);
    expect(screen.getByRole("button", { name: "Collapse folder src" })).toHaveAttribute("aria-expanded", "true");

    const file = screen.getByRole("button", { name: "Open file main.ts" });
    fireEvent.click(screen.getByRole("button", { name: "Open file notes.md" }));
    expect(screen.getByLabelText("Active file")).toHaveTextContent("notes.md");
    expect(file.tagName).toBe("BUTTON");
    fireEvent.click(file);
    expect(screen.getByLabelText("Active file")).toHaveTextContent("src/main.ts");

    expect(screen.getByRole("button", { name: "Create file in src" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create folder in src" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename file src/main.ts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete file src/main.ts" })).toBeInTheDocument();
  });

  it("reports duplicate creation inline without invoking a blocking alert", () => {
    vi.mocked(window.prompt).mockReturnValueOnce("notes.md");
    render(<ExplorerHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Create file" }));

    expect(screen.getByRole("alert")).toHaveTextContent("File was not created.");
    expect(screen.getByRole("alert")).toHaveTextContent("A file already exists at notes.md.");
    expect(screen.getByLabelText("File drafts")).toHaveTextContent("Keep me");
    expect(window.alert).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss explorer message" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("creates root and nested files while preserving existing drafts", () => {
    vi.mocked(window.prompt)
      .mockReturnValueOnce("utils.ts")
      .mockReturnValueOnce("helpers.ts");
    render(<ExplorerHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Create file" }));
    expect(within(screen.getByRole("navigation", { name: "Simulation file explorer" })).getByRole("status")).toHaveTextContent("File created.");
    expect(screen.getByLabelText("Active file")).toHaveTextContent("utils.ts");
    expect(screen.getByLabelText("File drafts")).toHaveTextContent("const draft = true;");
    expect(screen.getByLabelText("File drafts")).toHaveTextContent("// new file");

    fireEvent.click(screen.getByRole("button", { name: "Expand folder src" }));
    fireEvent.click(screen.getByRole("button", { name: "Create file in src" }));
    expect(screen.getByLabelText("Active file")).toHaveTextContent("src/helpers.ts");
    expect(screen.getByLabelText("File drafts")).toHaveTextContent("src/helpers.ts");
  });

  it("creates folders inline and reports duplicate folders without losing state", () => {
    vi.mocked(window.prompt)
      .mockReturnValueOnce("docs")
      .mockReturnValueOnce("docs")
      .mockReturnValueOnce("nested");
    render(<ExplorerHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Create folder" }));
    expect(within(screen.getByRole("navigation", { name: "Simulation file explorer" })).getByRole("status")).toHaveTextContent("Folder created.");
    expect(screen.getByRole("button", { name: "Open file README.md" })).toBeInTheDocument();
    expect(screen.getByLabelText("File drafts")).toHaveTextContent("Folder created for organization.");

    fireEvent.click(screen.getByRole("button", { name: "Create folder" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Folder was not created.");
    expect(window.alert).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Create folder in docs" }));
    expect(screen.getByRole("button", { name: "Collapse folder nested" })).toBeInTheDocument();
    expect(screen.getByLabelText("File drafts")).toHaveTextContent("docs/nested/README.md");
  });

  it("keeps file state intact until inline deletion is confirmed", () => {
    render(<ExplorerHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Expand folder src" }));

    fireEvent.click(screen.getByRole("button", { name: "Delete file src/main.ts" }));
    const confirmation = screen.getByText("Delete file?").closest("section");
    expect(confirmation).not.toBeNull();
    expect(within(confirmation!).getByText("src/main.ts")).toBeInTheDocument();
    expect(screen.getByLabelText("File drafts")).toHaveTextContent("const draft = true;");
    expect(window.confirm).not.toHaveBeenCalled();

    fireEvent.click(within(confirmation!).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Delete file?")).not.toBeInTheDocument();
    expect(screen.getByLabelText("File drafts")).toHaveTextContent("const draft = true;");

    fireEvent.click(screen.getByRole("button", { name: "Delete file src/main.ts" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(within(screen.getByRole("navigation", { name: "Simulation file explorer" })).getByRole("status")).toHaveTextContent("Item deleted.");
    expect(screen.getByLabelText("File drafts")).not.toHaveTextContent("src/main.ts");
    expect(screen.getByLabelText("Active file")).toHaveTextContent("notes.md");
  });

  it("warns before deleting a folder and removes only its descendants", () => {
    render(<ExplorerHarness initialFiles={{ "src/main.ts": "draft", "src/util.ts": "utility", "keep.ts": "keep" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete folder src" }));

    expect(screen.getByText("Every file in this folder will be removed.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.getByLabelText("File drafts")).not.toHaveTextContent("src/main.ts");
    expect(screen.getByLabelText("File drafts")).not.toHaveTextContent("src/util.ts");
    expect(screen.getByLabelText("File drafts")).toHaveTextContent("keep.ts");
    expect(screen.getByLabelText("Active file")).toHaveTextContent("keep.ts");
  });

  it("renames files and folders without changing draft contents", () => {
    vi.mocked(window.prompt)
      .mockReturnValueOnce("app.ts")
      .mockReturnValueOnce("source");
    render(<ExplorerHarness initialFiles={{ "src/main.ts": "important draft", "src/util.ts": "utility", "keep.md": "keep" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Expand folder src" }));

    fireEvent.click(screen.getByRole("button", { name: "Rename file src/main.ts" }));
    expect(window.prompt).toHaveBeenCalledWith("Rename to:", "main.ts");
    expect(screen.getByLabelText("Active file")).toHaveTextContent("src/app.ts");
    expect(screen.getByLabelText("File drafts")).toHaveTextContent("important draft");

    fireEvent.click(screen.getByRole("button", { name: "Rename folder src" }));
    expect(screen.getByLabelText("Active file")).toHaveTextContent("source/app.ts");
    expect(screen.getByLabelText("File drafts")).toHaveTextContent("source/app.ts");
    expect(screen.getByLabelText("File drafts")).toHaveTextContent("source/util.ts");
    expect(within(screen.getByRole("navigation", { name: "Simulation file explorer" })).getByRole("status")).toHaveTextContent("src → source");
  });

  it("blocks rename collisions inline and keeps both drafts", () => {
    vi.mocked(window.prompt).mockReturnValueOnce("second.ts");
    render(<ExplorerHarness initialFiles={{ "first.ts": "first draft", "second.ts": "second draft" }} initialActiveFile="first.ts" />);

    fireEvent.click(screen.getByRole("button", { name: "Rename file first.ts" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Item was not renamed.");
    expect(screen.getByLabelText("File drafts")).toHaveTextContent("first draft");
    expect(screen.getByLabelText("File drafts")).toHaveTextContent("second draft");
    expect(screen.getByLabelText("Active file")).toHaveTextContent("first.ts");
  });

  it("marks read-only files and omits destructive controls", () => {
    render(<ExplorerHarness initialFiles={{ "locked.ts": "protected" }} initialActiveFile="locked.ts" readOnlyFiles={["locked.ts"]} />);

    expect(screen.getByText("Read-only")).toHaveClass("sr-only");
    expect(screen.queryByRole("button", { name: "Rename file locked.ts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete file locked.ts" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("File drafts")).toHaveTextContent("protected");
  });

  it("treats cancelled and unchanged prompts as no-ops", () => {
    vi.mocked(window.prompt)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce("notes.md");
    render(<ExplorerHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Create file" }));
    fireEvent.click(screen.getByRole("button", { name: "Create folder" }));
    fireEvent.click(screen.getByRole("button", { name: "Rename file notes.md" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Simulation file explorer" })).queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByLabelText("File drafts")).toHaveTextContent("Keep me");
  });
});
