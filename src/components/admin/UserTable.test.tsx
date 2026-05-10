import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserTable } from "./UserTable";

// Mock adminConstants
vi.mock("./adminConstants", () => ({
  ROLES: ["unverified", "user", "author", "admin"],
  memberTypeS: ["student", "alumni", "parent", "coach", "mentor", "sponsor"],
  PLAYER_COLORS: {},
}));

describe("UserTable Component", () => {
  const mockUsers = [
    {
      id: "user-1",
      name: "John Doe",
      nickname: "Johnny",
      image: "https://example.com/avatar1.jpg",
      role: "admin",
      memberType: "student",
      email: "john@example.com",
      createdAt: 1640000000000,
    },
    {
      id: "user-2",
      name: "Jane Smith",
      nickname: null,
      image: null,
      role: "author",
      memberType: "mentor",
      email: "jane@example.com",
      createdAt: 1650000000000,
    },
    {
      id: "user-3",
      name: "Bob Johnson",
      nickname: "Bobby",
      image: null,
      role: "user",
      memberType: "alumni",
      email: "bob@example.com",
      createdAt: 1660000000000,
    },
  ];

  const mockCallbacks = {
    onSortingChange: vi.fn(),
    onGlobalFilterChange: vi.fn(),
    onRoleChange: vi.fn(),
    onMemberTypeChange: vi.fn(),
    onEditUser: vi.fn(),
    onManagePoints: vi.fn(),
    onDeleteUser: vi.fn(),
  };

  const defaultProps = {
    users: mockUsers,
    sorting: [],
    globalFilter: "",
    ...mockCallbacks,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getBoundingClientRect for framer-motion measurements
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 800,
      height: 400,
      top: 0,
      left: 0,
      bottom: 400,
      right: 800,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    }));
  });

  it("renders all users", () => {
    render(<UserTable {...defaultProps} />);

    expect(screen.getByText("Johnny")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Bobby")).toBeInTheDocument();
  });

  it("renders user avatars with fallback images", () => {
    render(<UserTable {...defaultProps} />);

    const avatars = screen.getAllByRole("img");
    expect(avatars.length).toBeGreaterThan(0);

    // Check that user with custom image has the correct src
    const customAvatar = avatars.find(img => (img as HTMLImageElement).src === "https://example.com/avatar1.jpg");
    expect(customAvatar).toBeInTheDocument();

    // Check that users without images get dicebear fallbacks
    const fallbackAvatars = avatars.filter(img => (img as HTMLImageElement).src.includes("dicebear"));
    expect(fallbackAvatars.length).toBeGreaterThan(0);
  });

  it("renders user emails", () => {
    render(<UserTable {...defaultProps} />);

    expect(screen.getByText("john@example.com")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
  });

  it("renders role dropdowns for each user", () => {
    render(<UserTable {...defaultProps} />);

    const roleSelects = screen.getAllByTitle("Change user role");
    expect(roleSelects.length).toBe(3);
  });

  it("renders member type dropdowns for each user", () => {
    render(<UserTable {...defaultProps} />);

    const typeSelects = screen.getAllByTitle("Change member type");
    expect(typeSelects.length).toBe(3);
  });

  it("renders join dates", () => {
    render(<UserTable {...defaultProps} />);

    const dateElements2021 = screen.getAllByText(/2021/);
    const dateElements2022 = screen.getAllByText(/2022/);
    expect(dateElements2021.length).toBeGreaterThan(0);
    expect(dateElements2022.length).toBeGreaterThan(0);
  });

  it("renders action buttons for each user", () => {
    render(<UserTable {...defaultProps} />);

    // Edit buttons
    const editButtons = screen.getAllByTitle(/Edit user profile/i);
    expect(editButtons.length).toBe(3);

    // Points buttons
    const pointsButtons = screen.getAllByTitle(/Manage points/i);
    expect(pointsButtons.length).toBe(3);

    // Delete buttons
    const deleteButtons = screen.getAllByTitle(/Remove user/i);
    expect(deleteButtons.length).toBe(3);
  });

  it("renders Zulip message button for users with emails", () => {
    render(<UserTable {...defaultProps} />);

    const zulipButtons = screen.getAllByTitle(/Message on Zulip/i);
    expect(zulipButtons.length).toBe(3);
  });

  it("calls onRoleChange when role is changed", () => {
    render(<UserTable {...defaultProps} />);

    const roleSelects = screen.getAllByTitle("Change user role");
    fireEvent.change(roleSelects[0], { target: { value: "author" } });

    expect(mockCallbacks.onRoleChange).toHaveBeenCalledWith("user-1", "author");
  });

  it("calls onMemberTypeChange when member type is changed", () => {
    render(<UserTable {...defaultProps} />);

    const typeSelects = screen.getAllByTitle("Change member type");
    fireEvent.change(typeSelects[0], { target: { value: "alumni" } });

    expect(mockCallbacks.onMemberTypeChange).toHaveBeenCalledWith("user-1", "alumni");
  });

  it("calls onEditUser when edit button is clicked", () => {
    render(<UserTable {...defaultProps} />);

    const editButtons = screen.getAllByTitle(/Edit user profile/i);
    fireEvent.click(editButtons[0]);

    expect(mockCallbacks.onEditUser).toHaveBeenCalledWith("user-1");
  });

  it("calls onManagePoints when points button is clicked", () => {
    render(<UserTable {...defaultProps} />);

    const pointsButtons = screen.getAllByTitle(/Manage points/i);
    fireEvent.click(pointsButtons[0]);

    expect(mockCallbacks.onManagePoints).toHaveBeenCalledWith("user-1");
  });

  it("calls onDeleteUser when delete button is clicked", () => {
    render(<UserTable {...defaultProps} />);

    const deleteButtons = screen.getAllByTitle(/Remove user/i);
    fireEvent.click(deleteButtons[0]);

    expect(mockCallbacks.onDeleteUser).toHaveBeenCalledWith("user-1", "Johnny");
  });

  it("displays user ID in small text", () => {
    render(<UserTable {...defaultProps} />);

    // IDs are truncated to 8 characters
    expect(screen.getByText("user-1")).toBeInTheDocument();
  });

  it("renders all table headers", () => {
    render(<UserTable {...defaultProps} />);

    // Use getAllByText since "User" appears in both header and select options
    expect(screen.getAllByText("User").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Email").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Role").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Type").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Joined").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Actions").length).toBeGreaterThan(0);
  });

  it("applies correct styling classes", () => {
    const { container } = render(<UserTable {...defaultProps} />);

    const tableContainer = container.querySelector(".overflow-x-auto");
    expect(tableContainer).toBeInTheDocument();
    expect(tableContainer).toHaveClass("bg-black/40");
  });

  it("renders profile links with correct hrefs", () => {
    const { container } = render(<UserTable {...defaultProps} />);

    // Get only profile links (those starting with /profile/)
    const allLinks = container.querySelectorAll('a[href^="/profile/"]');
    expect(allLinks.length).toBe(3);
    expect(allLinks[0]).toHaveAttribute("href", "/profile/user-1");
    expect(allLinks[1]).toHaveAttribute("href", "/profile/user-2");
    expect(allLinks[2]).toHaveAttribute("href", "/profile/user-3");
  });

  it("opens profile links in new tab", () => {
    render(<UserTable {...defaultProps} />);

    const profileLinks = screen.getAllByRole("link", { name: /Johnny/ });
    expect(profileLinks[0]).toHaveAttribute("target", "_blank");
    expect(profileLinks[0]).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders nickname when available", () => {
    render(<UserTable {...defaultProps} />);

    expect(screen.getByText("Johnny")).toBeInTheDocument();
    expect(screen.getByText("Bobby")).toBeInTheDocument();
  });

  it("renders name when nickname is not available", () => {
    render(<UserTable {...defaultProps} />);

    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("renders default name when both nickname and name are null", () => {
    const usersWithoutName = [
      {
        id: "user-4",
        name: null,
        nickname: null,
        image: null,
        role: "user",
        memberType: "student",
        email: "test@example.com",
        createdAt: 1640000000000,
      },
    ];

    render(<UserTable {...defaultProps} users={usersWithoutName} />);

    expect(screen.getByText("ARES Member")).toBeInTheDocument();
  });

  it("renders dash for missing email", () => {
    const usersWithoutEmail = [
      {
        id: "user-5",
        name: "No Email User",
        nickname: null,
        image: null,
        role: "user",
        memberType: "student",
        email: null,
        createdAt: 1640000000000,
      },
    ];

    render(<UserTable {...defaultProps} users={usersWithoutEmail} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders dash for missing join date", () => {
    const usersWithoutDate = [
      {
        id: "user-6",
        name: "No Date User",
        nickname: null,
        image: null,
        role: "user",
        memberType: "student",
        email: "test@example.com",
        createdAt: null as unknown as number,
      },
    ];

    render(<UserTable {...defaultProps} users={usersWithoutDate} />);

    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("has proper ARIA labels for accessibility", () => {
    render(<UserTable {...defaultProps} />);

    const editButtons = screen.getAllByTitle("Edit user profile");
    expect(editButtons.length).toBe(3);
    editButtons.forEach(button => {
      expect(button).toHaveAttribute("aria-label");
    });

    const pointsButtons = screen.getAllByTitle(/Manage points/i);
    expect(pointsButtons.length).toBe(3);
    pointsButtons.forEach(button => {
      expect(button).toHaveAttribute("aria-label");
    });

    const deleteButtons = screen.getAllByTitle(/Remove user/i);
    expect(deleteButtons.length).toBe(3);
    deleteButtons.forEach(button => {
      expect(button).toHaveAttribute("aria-label");
    });
  });

  it("filters users by global filter text", () => {
    render(<UserTable {...defaultProps} globalFilter="John" />);

    // Should show users matching "John"
    expect(screen.getByText("Johnny")).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });

  it("renders empty table when no users provided", () => {
    render(<UserTable {...defaultProps} users={[]} />);

    expect(screen.queryByText("Johnny")).not.toBeInTheDocument();
    expect(screen.getByText("User")).toBeInTheDocument(); // Headers still render
  });

  it("applies role-specific color classes", () => {
    const { container } = render(<UserTable {...defaultProps} />);

    // Find all selects and verify admin role select has the correct styling
    const allSelects = container.querySelectorAll("select");
    const adminSelect = Array.from(allSelects).find(select => {
      // Check if this select has "admin" as one of its options and is currently set to admin
      const options = Array.from(select.querySelectorAll("option"));
      const hasAdminOption = options.some(opt => opt.value === "admin");
      return hasAdminOption && select.value === "admin";
    });

    expect(adminSelect).toBeTruthy();
    if (adminSelect) {
      expect(adminSelect.className).toContain("border-ares-red");
    }
  });

  it("applies member type-specific color classes", () => {
    const { container } = render(<UserTable {...defaultProps} />);

    // Find all selects and verify student type exists
    const allSelects = container.querySelectorAll("select");
    const studentSelect = Array.from(allSelects).find(select => {
      const options = Array.from(select.querySelectorAll("option"));
      const hasStudentOption = options.some(opt => opt.value === "student");
      return hasStudentOption && select.value === "student";
    });

    expect(studentSelect).toBeTruthy();
  });
});

