import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserRevocationDialog } from "@/app/dashboard/users/components/UserDirectoryControls";

describe("UserRevocationDialog", () => {
  it("keeps the account impact visible and confirms the requested revocation", () => {
    const onConfirm = vi.fn();

    render(
      <UserRevocationDialog
        target={{ name: "Alex Member", email: "alex@example.org" }}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Revoke roster access?" }),
    ).toHaveTextContent(
      "Alex Member will be signed out of team tools. Their profile and audit history will be archived, not deleted, and an administrator can restore access later.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Revoke access" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
