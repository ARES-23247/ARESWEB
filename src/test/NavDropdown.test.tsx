import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Users } from "lucide-react";
import { describe, expect, it } from "vitest";
import { NavDropdown } from "@/components/navigation/NavDropdown";

function Harness() {
  const [open, setOpen] = useState(false);
  return <MemoryRouter><NavDropdown label="Team" isOpen={open}
    onToggle={() => setOpen(value => !value)} onItemClick={() => setOpen(false)}
    items={[{ label: "About", to: "/about", icon: Users, iconColor: "text-white" }]} />
    <button type="button">Outside</button></MemoryRouter>;
}

describe("desktop navigation disclosure", () => {
  it("keeps closed links inaccessible and lets Escape close and restore trigger focus", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Team" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "About" })).not.toBeInTheDocument();
    fireEvent.click(trigger);
    const link = screen.getByRole("link", { name: "About" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    link.focus();
    fireEvent.keyDown(link, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(link).not.toBeVisible();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("link", { name: "About" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
  it("keeps focus inside usable and closes when focus leaves", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Team" });
    fireEvent.click(trigger);
    const link = screen.getByRole("link", { name: "About" });
    fireEvent.blur(trigger, { relatedTarget: link });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.blur(link, { relatedTarget: screen.getByRole("button", { name: "Outside" }) });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
