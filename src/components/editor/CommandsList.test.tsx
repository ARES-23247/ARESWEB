import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommandsList, CommandsListRef } from "./CommandsList";
import { Editor } from "@tiptap/react";

// Mock the toast module
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Mock Lucide React icons - return simple spans for testing
vi.mock("lucide-react", () => ({
  Heading1: () => <span data-testid="icon-h1">H1</span>,
  Heading2: () => <span data-testid="icon-h2">H2</span>,
  List: () => <span data-testid="icon-list">List</span>,
  ListTodo: () => <span data-testid="icon-todo">Todo</span>,
  Quote: () => <span data-testid="icon-quote">Quote</span>,
  Code: () => <span data-testid="icon-code">Code</span>,
  Table: () => <span data-testid="icon-table">Table</span>,
  Info: () => <span data-testid="icon-info">Info</span>,
  AlertTriangle: () => <span data-testid="icon-alert">Alert</span>,
  Lightbulb: () => <span data-testid="icon-tip">Tip</span>,
  Workflow: () => <span data-testid="icon-workflow">Workflow</span>,
  TerminalSquare: () => <span data-testid="icon-terminal">Terminal</span>,
  BookOpen: () => <span data-testid="icon-book">Book</span>,
}));

// Create a mock Editor
const createMockEditor = (): Partial<Editor> => ({
  chain: vi.fn(() => ({
    focus: vi.fn(() => ({
      deleteRange: vi.fn(() => ({
        setNode: vi.fn(() => ({ run: vi.fn() })),
        toggleBulletList: vi.fn(() => ({ run: vi.fn() })),
        toggleTaskList: vi.fn(() => ({ run: vi.fn() })),
        toggleBlockquote: vi.fn(() => ({ run: vi.fn() })),
        toggleCodeBlock: vi.fn(() => ({ run: vi.fn() })),
        setCallout: vi.fn(() => ({ run: vi.fn() })),
        insertTable: vi.fn(() => ({ run: vi.fn() })),
        run: vi.fn(),
      })),
      insertContent: vi.fn(() => ({ run: vi.fn() })),
    })),
  })) as any,
  state: {
    doc: {
      descendants: vi.fn((callback) => {
        // Mock some heading nodes
        callback(
          {
            type: { name: "heading" },
            attrs: { level: 2 },
            textContent: "Test Heading",
          },
          0
        );
      }),
    } as any,
  } as any,
});

const mockRange = { from: 0, to: 10 };

describe("CommandsList Component", () => {
  let mockEditor: Partial<Editor>;
  let ref: React.RefObject<CommandsListRef>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor = createMockEditor();
  });

  it("renders all command items", () => {
    render(<CommandsList editor={mockEditor as Editor} range={mockRange} items={[]} />);

    // Check for main command items (using getAllByText for items that may appear multiple times)
    expect(screen.getByText("Heading 1")).toBeInTheDocument();
    expect(screen.getByText("Heading 2")).toBeInTheDocument();
    expect(screen.getByText("Bullet List")).toBeInTheDocument();
    expect(screen.getByText("Task List")).toBeInTheDocument();
    expect(screen.getByText(/Capture a quote/)).toBeInTheDocument();
    expect(screen.getByText("Code Block")).toBeInTheDocument();
    expect(screen.getByText("Mermaid Diagram")).toBeInTheDocument();
    expect(screen.getByText("Interactive Simulator")).toBeInTheDocument();
    expect(screen.getByText("Info Callout")).toBeInTheDocument();
    expect(screen.getByText("Warning Callout")).toBeInTheDocument();
    expect(screen.getByText("Tip Callout")).toBeInTheDocument();
    expect(screen.getAllByText("Table")).toHaveLength(2); // Table appears in command and description
    expect(screen.getByText("Table of Contents")).toBeInTheDocument();
  });

  it("renders command descriptions", () => {
    render(<CommandsList editor={mockEditor as Editor} range={mockRange} items={[]} />);

    expect(screen.getByText("Big section heading")).toBeInTheDocument();
    expect(screen.getByText("Medium section heading")).toBeInTheDocument();
    expect(screen.getByText("Create a simple bullet list")).toBeInTheDocument();
    expect(screen.getByText("Track tasks with checkboxes")).toBeInTheDocument();
    expect(screen.getByText("Capture a quote")).toBeInTheDocument();
    expect(screen.getByText("Syntax highlighted code")).toBeInTheDocument();
  });

  it("renders commands header", () => {
    render(<CommandsList editor={mockEditor as Editor} range={mockRange} items={[]} />);

    expect(screen.getByText("Commands")).toBeInTheDocument();
  });

  it("highlights selected item on click", () => {
    render(<CommandsList editor={mockEditor as Editor} range={mockRange} items={[]} />);

    const firstItem = screen.getByText("Heading 1").closest("button");
    expect(firstItem).toBeInTheDocument();

    if (firstItem) {
      fireEvent.click(firstItem);

      // After click, the command should be executed
      expect(mockEditor.chain).toHaveBeenCalled();
    }
  });

  it("has proper ARES styling classes", () => {
    const { container } = render(<CommandsList editor={mockEditor as Editor} range={mockRange} items={[]} />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("bg-obsidian");
    expect(wrapper).toHaveClass("border");
    expect(wrapper).toHaveClass("ares-cut-sm");
    expect(wrapper).toHaveClass("shadow-2xl");
    expect(wrapper).toHaveClass("overflow-hidden");
    expect(wrapper).toHaveClass("backdrop-blur-xl");
  });

  it("renders icons for each command", () => {
    render(<CommandsList editor={mockEditor as Editor} range={mockRange} items={[]} />);

    expect(screen.getByTestId("icon-h1")).toBeInTheDocument();
    expect(screen.getByTestId("icon-h2")).toBeInTheDocument();
    expect(screen.getByTestId("icon-list")).toBeInTheDocument();
    expect(screen.getByTestId("icon-todo")).toBeInTheDocument();
    expect(screen.getByTestId("icon-quote")).toBeInTheDocument();
    expect(screen.getByTestId("icon-code")).toBeInTheDocument();
    expect(screen.getByTestId("icon-table")).toBeInTheDocument();
  });

  it("renders special command icons", () => {
    render(<CommandsList editor={mockEditor as Editor} range={mockRange} items={[]} />);

    // Info callout icon
    expect(screen.getByTestId("icon-info")).toBeInTheDocument();

    // Warning callout icon
    expect(screen.getByTestId("icon-alert")).toBeInTheDocument();

    // Tip callout icon
    expect(screen.getByTestId("icon-tip")).toBeInTheDocument();

    // Mermaid/Workflow icon
    expect(screen.getByTestId("icon-workflow")).toBeInTheDocument();

    // Simulator/Terminal icon
    expect(screen.getByTestId("icon-terminal")).toBeInTheDocument();

    // TOC/Book icon
    expect(screen.getByTestId("icon-book")).toBeInTheDocument();
  });

  it("handles keyboard navigation via ref", () => {
    let capturedRef: CommandsListRef | null = null;

    const TestComponent = () => {
      const ref = React.createRef<CommandsListRef>();

      React.useEffect(() => {
        capturedRef = ref.current;
        if (ref.current) {
          // Test Arrow Down
          const downEvent = new KeyboardEvent("keydown", { key: "ArrowDown" });
          const handledDown = ref.current.onKeyDown({ event: downEvent });
          expect(handledDown).toBe(true);

          // Test Arrow Up
          const upEvent = new KeyboardEvent("keydown", { key: "ArrowUp" });
          const handledUp = ref.current.onKeyDown({ event: upEvent });
          expect(handledUp).toBe(true);

          // Test Enter
          const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
          const handledEnter = ref.current.onKeyDown({ event: enterEvent });
          expect(handledEnter).toBe(true);

          // Test unhandled key
          const otherEvent = new KeyboardEvent("keydown", { key: "Escape" });
          const handledOther = ref.current.onKeyDown({ event: otherEvent });
          expect(handledOther).toBe(false);
        }
      }, []);

      return <CommandsList editor={mockEditor as Editor} range={mockRange} items={[]} ref={ref} />;
    };

    render(<TestComponent />);
  });

  it("executes Heading 1 command", () => {
    render(<CommandsList editor={mockEditor as Editor} range={mockRange} items={[]} />);

    const h1Button = screen.getByText("Heading 1").closest("button");
    if (h1Button) {
      fireEvent.click(h1Button);

      expect(mockEditor.chain).toHaveBeenCalled();
    }
  });

  it("executes Heading 2 command", () => {
    render(<CommandsList editor={mockEditor as Editor} range={mockRange} items={[]} />);

    const h2Button = screen.getByText("Heading 2").closest("button");
    if (h2Button) {
      fireEvent.click(h2Button);

      expect(mockEditor.chain).toHaveBeenCalled();
    }
  });

  it("executes Bullet List command", () => {
    render(<CommandsList editor={mockEditor as Editor} range={mockRange} items={[]} />);

    const listButton = screen.getByText("Bullet List").closest("button");
    if (listButton) {
      fireEvent.click(listButton);

      expect(mockEditor.chain).toHaveBeenCalled();
    }
  });

  it("executes Task List command", () => {
    render(<CommandsList editor={mockEditor as Editor} range={mockRange} items={[]} />);

    const todoButton = screen.getByText("Task List").closest("button");
    if (todoButton) {
      fireEvent.click(todoButton);

      expect(mockEditor.chain).toHaveBeenCalled();
    }
  });

  it("has proper hover and selected states", () => {
    const { container } = render(<CommandsList editor={mockEditor as Editor} range={mockRange} items={[]} />);

    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);

    buttons.forEach((button) => {
      expect(button).toHaveClass("transition-all");
      expect(button).toHaveClass("ares-cut-sm");
    });
  });

  it("has proper command section header styling", () => {
    render(<CommandsList editor={mockEditor as Editor} range={mockRange} items={[]} />);

    const header = screen.getByText("Commands");
    expect(header).toHaveClass("text-xs");
    expect(header).toHaveClass("font-bold");
    expect(header).toHaveClass("text-marble/60");
    expect(header).toHaveClass("uppercase");
    expect(header).toHaveClass("tracking-widest");
  });

  it("has proper item button structure", () => {
    const { container } = render(<CommandsList editor={mockEditor as Editor} range={mockRange} items={[]} />);

    const firstButton = container.querySelector("button");
    expect(firstButton).toHaveClass("flex");
    expect(firstButton).toHaveClass("items-center");
    expect(firstButton).toHaveClass("gap-3");
    expect(firstButton).toHaveClass("text-left");
  });

  it("has proper animation classes", () => {
    const { container } = render(<CommandsList editor={mockEditor as Editor} range={mockRange} items={[]} />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("animate-in");
    expect(wrapper).toHaveClass("fade-in");
    expect(wrapper).toHaveClass("zoom-in");
  });
});
