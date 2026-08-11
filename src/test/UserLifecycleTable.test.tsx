import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UserRosterTable, { type UserAuth } from "../app/dashboard/users/components/UserRosterTable";

const baseUser: UserAuth = {
  id: "private-firebase-uid",
  email: "member@example.org",
  role: "member",
  name: "Member Nickname",
  isRegistered: true,
  avatar: "",
  subteams: ["Programming"],
  memberType: "student",
  profileExists: true,
  zulipAccount: null,
};

function renderTable(users: UserAuth[], overrides: Partial<React.ComponentProps<typeof UserRosterTable>> = {}) {
  const props: React.ComponentProps<typeof UserRosterTable> = {
    filteredUsers: users,
    isLoading: false,
    editedRoles: {},
    editedMemberTypes: {},
    savingRoles: {},
    creatingZulip: {},
    onRoleChange: vi.fn(),
    onMemberTypeChange: vi.fn(),
    onSaveRole: vi.fn(),
    onCreateZulip: vi.fn(),
    onRemoveUser: vi.fn(),
    onRestoreUser: vi.fn(),
    ...overrides,
  };
  render(<UserRosterTable {...props} />);
  return props;
}

describe("UserRosterTable lifecycle controls", () => {
  it("uses a local placeholder and requests recoverable access revocation", () => {
    const onRemoveUser = vi.fn();
    renderTable([baseUser], { onRemoveUser });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("api.dicebear.com");
    fireEvent.click(screen.getByRole("button", { name: /revoke roster access/i }));
    expect(onRemoveUser).toHaveBeenCalledWith("private-firebase-uid");
  });

  it("marks archived accounts, disables permission controls, and restores them", () => {
    const onRestoreUser = vi.fn();
    renderTable([{ ...baseUser, isDeleted: true }], { onRestoreUser });

    expect(screen.getByText("Access revoked")).toBeInTheDocument();
    expect(screen.getByLabelText("Portal Role")).toBeDisabled();
    expect(screen.getByLabelText("Member Type")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /restore roster access/i }));
    expect(onRestoreUser).toHaveBeenCalledWith("private-firebase-uid");
  });
});
