import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TaskDetailsModal from "./TaskDetailsModal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Define task type based on the component's expected TaskItem type
// Matches the TaskSchema from @shared/routes/tasks.ts
interface MockTask {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done" | "blocked";
  priority: "low" | "normal" | "high" | "urgent";
  sort_order: number;
  assignees: Array<{ id: string; nickname: string | null }>;
  created_by: string;
  creator_name: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  subteam: string | null;
  zulip_stream: string | null;
  zulip_topic: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  parent_id: string | null;
  time_spent_seconds: number | null;
}

const mockTask: MockTask = {
  id: "task-123",
  title: "Test Task Title",
  description: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test description"}]}]}',
  status: "in_progress",
  priority: "normal",
  sort_order: 0,
  assignees: [{ id: "user1", nickname: null }],
  created_by: "user1",
  creator_name: "Test Creator",
  due_date: "2024-12-31",
  time_spent_seconds: 3600,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-02T00:00:00Z",
  subteam: "Mechanical",
  zulip_stream: "tasks",
  zulip_topic: "Task: Test Task Title",
  assigned_to: null,
  assignee_name: null,
  parent_id: null,
};

// Mock the imports
vi.mock("../../api", () => ({
  useGetUsers: () => ({
    data: {
      users: [
        { id: "user1", nickname: "User One", name: "User One Name" },
        { id: "user2", nickname: "User Two", name: "User Two Name" },
      ],
    },
  }),
  useCreateTask: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "new-task" }),
  }),
  useGetTasks: () => ({
    data: {
      tasks: [],
    },
  }),
}));

vi.mock("../editor/CollaborativeEditorRoom", () => ({
  CollaborativeEditorRoom: ({ children }: { children: React.ReactNode }) => <div data-testid="collab-editor">{children}</div>,
  useCollaborativeEditor: () => ({
    ydoc: null,
    provider: null,
  }),
}));

vi.mock("../editor/useRichEditor", () => ({
  useRichEditor: () => null,
}));

vi.mock("@tiptap/react", () => ({
  EditorContent: ({ className }: { editor: unknown; className: string }) => (
    <div className={className} data-testid="editor-content">
      Mock Editor Content
    </div>
  ),
}));

vi.mock("../ZulipThread", () => ({
  default: ({ stream, topic, className }: { stream: string; topic: string; className: string }) => (
    <div className={className} data-testid="zulip-thread">
      Zulip: {stream} / {topic}
    </div>
  ),
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

function renderWithQueryClient(component: React.ReactElement) {
  const queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
}

describe("TaskDetailsModal Component", () => {
  let mockOnSave: ReturnType<typeof vi.fn>;
  let mockOnDelete: ReturnType<typeof vi.fn>;
  let mockOnClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave = vi.fn().mockResolvedValue(undefined);
    mockOnDelete = vi.fn();
    mockOnClose = vi.fn();
  });

  it("renders task details", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    // Title is in an input field
    expect(screen.getByDisplayValue("Test Task Title")).toBeInTheDocument();
  });

  it("renders task ID in header", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText(/ID: task-123/)).toBeInTheDocument();
  });

  it("renders all status options", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText("Todo")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Parked")).toBeInTheDocument();
  });

  it("renders all priority options", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Urgent")).toBeInTheDocument();
  });

  it("renders subteam selector", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    const selectElement = screen.getByDisplayValue("Mechanical");
    expect(selectElement).toBeInTheDocument();
  });

  it("renders assignees section", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText(/Assignees/)).toBeInTheDocument();
    expect(screen.getByText("User One")).toBeInTheDocument();
  });

  it("renders due date input", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    const dateInput = screen.getByLabelText(/Due Date/);
    expect(dateInput).toBeInTheDocument();
    expect(dateInput).toHaveValue("2024-12-31");
  });

  it("shows overdue indicator for past due dates", () => {
    const overdueTask: MockTask = {
      ...mockTask,
      due_date: "2020-01-01",
      status: "in_progress",
    };

    renderWithQueryClient(
      <TaskDetailsModal
        task={overdueTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("renders time logged inputs", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByPlaceholderText("HH")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("MM")).toBeInTheDocument();
  });

  it("renders Zulip thread integration", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByTestId("zulip-thread")).toBeInTheDocument();
  });

  it("closes when clicking close button", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    const closeButton = screen.getByTitle("Close modal");
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape key", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("renders collaborative editor", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByTestId("collab-editor")).toBeInTheDocument();
  });

  it("disables save button when title is empty", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    const titleInput = screen.getByDisplayValue("Test Task Title");
    fireEvent.change(titleInput, { target: { value: "" } });

    const saveButton = screen.getByText("Save Changes");
    expect(saveButton).toBeDisabled();
  });

  it("renders metadata in footer", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText(/Created/)).toBeInTheDocument();
    expect(screen.getByText(/by Test Creator/)).toBeInTheDocument();
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });

  it("has proper ARIA attributes", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("has proper ARES styling classes", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("bg-obsidian");
    expect(dialog).toHaveClass("border");
    expect(dialog).toHaveClass("ares-cut-md");
    expect(dialog).toHaveClass("shadow-2xl");
  });

  it("renders subtasks section", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText(/Subtasks/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add a new subtask...")).toBeInTheDocument();
  });

  it("allows adding new subtask via Enter key", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    const input = screen.getByPlaceholderText("Add a new subtask...");
    fireEvent.change(input, { target: { value: "New subtask" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Should have called mutateAsync (via the mocked hook)
    expect((input as HTMLInputElement).value).toBe(""); // Cleared after submission
  });

  it("shows no subtasks message when empty", () => {
    renderWithQueryClient(
      <TaskDetailsModal
        task={mockTask}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText("No subtasks found.")).toBeInTheDocument();
  });
});
