import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ContactForm } from "./ContactForm";
import type { ProfileData } from "./types";

const mockSetProfile = vi.fn();

const defaultProfile: ProfileData = {
  phone: "",
  contact_email: "",
  show_phone: false,
  show_email: false,
} as ProfileData;

// Create a mock TanStack Form-like object
const createMockForm = (profile: ProfileData) => ({
  Field: ({ name, children }: any) => {
    const field = {
      name,
      state: {
        value: (profile as any)[name],
        meta: { errors: [] }
      },
      handleBlur: vi.fn(),
      handleChange: (val: any) => {
        mockSetProfile((prev: any) => ({ ...prev, [name]: val }));
      }
    };
    return children(field);
  }
});

const defaultProps = {
  form: createMockForm(defaultProfile) as any,
  isMinor: false,
  inputClass: "w-full bg-white/5 border border-white/10 px-4 py-2 text-white",
  labelClass: "text-xs font-bold uppercase tracking-widest text-marble/50",
  sectionClass: "space-y-4",
};

describe("ContactForm Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetProfile.mockImplementation((updater) => {
      if (typeof updater === "function") {
        return updater(defaultProfile);
      }
      return updater;
    });
  });

  it("renders nothing when isMinor is true", () => {
    render(<ContactForm {...defaultProps} isMinor={true} />);
    expect(screen.queryByText("Contact")).not.toBeInTheDocument();
  });

  it("renders contact section when isMinor is false", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);
    expect(screen.getByText("Contact (Optional)")).toBeInTheDocument();
  });

  it("renders phone input field", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);
    const phoneInput = screen.getByLabelText("Phone");
    expect(phoneInput).toBeInTheDocument();
    expect(phoneInput).toHaveAttribute("placeholder", "(304) 555-1234");
  });

  it("renders contact email input field", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);
    const emailInput = screen.getByLabelText("Contact Email");
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("type", "email");
  });

  it("renders show phone checkbox", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);
    const showPhoneCheckbox = screen.getByRole("checkbox", { name: /show phone number on public profile/i });
    expect(showPhoneCheckbox).toBeInTheDocument();
  });

  it("renders show email checkbox", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);
    const showEmailCheckbox = screen.getByRole("checkbox", { name: /show email on public profile/i });
    expect(showEmailCheckbox).toBeInTheDocument();
  });

  it("updates phone value when user types", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);
    const phoneInput = screen.getByLabelText("Phone");
    fireEvent.change(phoneInput, { target: { value: "(304) 555-1234" } });
    expect(mockSetProfile).toHaveBeenCalled();
  });

  it("updates contact email value when user types", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);
    const emailInput = screen.getByLabelText("Contact Email");
    fireEvent.change(emailInput, { target: { value: "user@example.com" } });
    expect(mockSetProfile).toHaveBeenCalled();
  });

  it("toggles show_phone checkbox", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);
    const showPhoneCheckbox = screen.getByRole("checkbox", { name: /show phone number on public profile/i });
    fireEvent.click(showPhoneCheckbox);
    expect(mockSetProfile).toHaveBeenCalled();
  });

  it("toggles show_email checkbox", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);
    const showEmailCheckbox = screen.getByRole("checkbox", { name: /show email on public profile/i });
    fireEvent.click(showEmailCheckbox);
    expect(mockSetProfile).toHaveBeenCalled();
  });

  it("initializes with existing phone value", () => {
    const customProfile = { ...defaultProfile, phone: "(555) 123-4567" };
    const props = { ...defaultProps, form: createMockForm(customProfile) as any };
    render(<ContactForm {...props} />);
    const phoneInput = screen.getByLabelText("Phone") as HTMLInputElement;
    expect(phoneInput.value).toBe("(555) 123-4567");
  });

  it("initializes with existing contact email value", () => {
    const customProfile = { ...defaultProfile, contact_email: "existing@example.com" };
    const props = { ...defaultProps, form: createMockForm(customProfile) as any };
    render(<ContactForm {...props} />);
    const emailInput = screen.getByLabelText("Contact Email") as HTMLInputElement;
    expect(emailInput.value).toBe("existing@example.com");
  });

  it("has proper input classes applied", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);
    const phoneInput = screen.getByLabelText("Phone");
    expect(phoneInput).toHaveClass("w-full");
    expect(phoneInput).toHaveClass("bg-white/5");
  });

  it("has proper section heading styling", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);
    const heading = screen.getByText("Contact (Optional)");
    expect(heading).toHaveClass("text-ares-red");
  });

  it("has proper accessibility labels for checkboxes", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);
    const showPhoneCheckbox = screen.getByRole("checkbox", { name: /show phone number on public profile/i });
    expect(showPhoneCheckbox).toHaveAttribute("aria-label", "Show phone number on public profile");
  });
});
