import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContactForm } from "./ContactForm";
import type { ProfileData } from "./types";

const mockSetProfile = vi.fn();

const defaultProps = {
  profile: {
    phone: "",
    contact_email: "",
    show_phone: false,
    show_email: false,
  } as ProfileData,
  setProfile: mockSetProfile,
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
        const newProfile = updater(defaultProps.profile);
        return newProfile;
      }
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

    expect(mockSetProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "(304) 555-1234",
      })
    );
  });

  it("updates contact email value when user types", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);

    const emailInput = screen.getByLabelText("Contact Email");
    fireEvent.change(emailInput, { target: { value: "user@example.com" } });

    expect(mockSetProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        contact_email: "user@example.com",
      })
    );
  });

  it("toggles show_phone checkbox", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);

    const showPhoneCheckbox = screen.getByRole("checkbox", { name: /show phone number on public profile/i });
    expect(showPhoneCheckbox).not.toBeChecked();

    fireEvent.click(showPhoneCheckbox);

    expect(mockSetProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        show_phone: true,
      })
    );
  });

  it("toggles show_email checkbox", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);

    const showEmailCheckbox = screen.getByRole("checkbox", { name: /show email on public profile/i });
    expect(showEmailCheckbox).not.toBeChecked();

    fireEvent.click(showEmailCheckbox);

    expect(mockSetProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        show_email: true,
      })
    );
  });

  it("initializes with existing phone value", () => {
    const props = {
      ...defaultProps,
      profile: {
        ...defaultProps.profile,
        phone: "(555) 123-4567",
      },
    };

    render(<ContactForm {...props} />);

    const phoneInput = screen.getByLabelText("Phone") as HTMLInputElement;
    expect(phoneInput.value).toBe("(555) 123-4567");
  });

  it("initializes with existing contact email value", () => {
    const props = {
      ...defaultProps,
      profile: {
        ...defaultProps.profile,
        contact_email: "existing@example.com",
      },
    };

    render(<ContactForm {...props} />);

    const emailInput = screen.getByLabelText("Contact Email") as HTMLInputElement;
    expect(emailInput.value).toBe("existing@example.com");
  });

  it("initializes show_phone checkbox as checked", () => {
    const props = {
      ...defaultProps,
      profile: {
        ...defaultProps.profile,
        show_phone: true,
      },
    };

    render(<ContactForm {...props} />);

    const showPhoneCheckbox = screen.getByRole("checkbox", { name: /show phone number on public profile/i });
    expect(showPhoneCheckbox).toBeChecked();
  });

  it("initializes show_email checkbox as checked", () => {
    const props = {
      ...defaultProps,
      profile: {
        ...defaultProps.profile,
        show_email: true,
      },
    };

    render(<ContactForm {...props} />);

    const showEmailCheckbox = screen.getByRole("checkbox", { name: /show email on public profile/i });
    expect(showEmailCheckbox).toBeChecked();
  });

  it("has proper input classes applied", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);

    const phoneInput = screen.getByLabelText("Phone");
    expect(phoneInput).toHaveClass("w-full");
    expect(phoneInput).toHaveClass("bg-white/5");
  });

  it("has proper label classes applied", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);

    const phoneLabel = screen.getByText("Phone");
    expect(phoneLabel).toHaveClass("text-xs");
    expect(phoneLabel).toHaveClass("font-bold");
    expect(phoneLabel).toHaveClass("uppercase");
    expect(phoneLabel).toHaveClass("tracking-widest");
  });

  it("has proper checkbox styling with ARES brand color", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);

    const checkboxes = screen.getAllByRole("checkbox");
    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveClass("accent-ares-red");
    });
  });

  it("has proper section heading styling", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);

    const heading = screen.getByText("Contact (Optional)");
    expect(heading).toHaveClass("text-sm");
    expect(heading).toHaveClass("font-black");
    expect(heading).toHaveClass("uppercase");
    expect(heading).toHaveClass("tracking-wider");
    expect(heading).toHaveClass("text-ares-red");
  });

  it("has proper grid layout for two columns", () => {
    const { container } = render(<ContactForm {...defaultProps} isMinor={false} />);

    const grid = container.querySelector(".grid");
    expect(grid).toHaveClass("grid-cols-1");
    expect(grid).toHaveClass("md:grid-cols-2");
    expect(grid).toHaveClass("gap-4");
  });

  it("contact email input has email validation attributes", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);

    const emailInput = screen.getByLabelText("Contact Email");
    expect(emailInput).toHaveAttribute("type", "email");
    expect(emailInput).toHaveAttribute("pattern");
    expect(emailInput).toHaveAttribute("title", "Please enter a valid email address");
  });

  it("has proper checkbox labels with ARES gray styling", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);

    const phoneCheckboxLabel = screen.getByText("Show on public profile", { selector: "label.flex" });
    expect(phoneCheckboxLabel).toHaveClass("text-xs");
    expect(phoneCheckboxLabel).toHaveClass("text-ares-gray");
  });

  it("has proper accessibility labels for checkboxes", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);

    const showPhoneCheckbox = screen.getByRole("checkbox", { name: /show phone number on public profile/i });
    expect(showPhoneCheckbox).toHaveAttribute("aria-label", "Show phone number on public profile");

    const showEmailCheckbox = screen.getByRole("checkbox", { name: /show email on public profile/i });
    expect(showEmailCheckbox).toHaveAttribute("aria-label", "Show email on public profile");
  });

  it("has proper HTML structure with correct htmlFor associations", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);

    const phoneInput = screen.getByLabelText("Phone");
    const phoneLabel = screen.getByText("Phone");

    expect(phoneLabel.tagName).toBe("LABEL");
    expect(phoneInput).toHaveAttribute("id", "pe-phone");
    expect(phoneLabel).toHaveAttribute("for", "pe-phone");

    const emailInput = screen.getByLabelText("Contact Email");
    const emailLabel = screen.getByText("Contact Email");

    expect(emailLabel.tagName).toBe("LABEL");
    expect(emailInput).toHaveAttribute("id", "pe-contact-email");
    expect(emailLabel).toHaveAttribute("for", "pe-contact-email");
  });

  it("handles unchecking show_phone checkbox", () => {
    const props = {
      ...defaultProps,
      profile: {
        ...defaultProps.profile,
        show_phone: true,
      },
    };

    render(<ContactForm {...props} />);

    const showPhoneCheckbox = screen.getByRole("checkbox", { name: /show phone number on public profile/i });
    expect(showPhoneCheckbox).toBeChecked();

    fireEvent.click(showPhoneCheckbox);

    expect(mockSetProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        show_phone: false,
      })
    );
  });

  it("handles unchecking show_email checkbox", () => {
    const props = {
      ...defaultProps,
      profile: {
        ...defaultProps.profile,
        show_email: true,
      },
    };

    render(<ContactForm {...props} />);

    const showEmailCheckbox = screen.getByRole("checkbox", { name: /show email on public profile/i });
    expect(showEmailCheckbox).toBeChecked();

    fireEvent.click(showEmailCheckbox);

    expect(mockSetProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        show_email: false,
      })
    );
  });

  it("displays placeholder text for contact email", () => {
    render(<ContactForm {...defaultProps} isMinor={false} />);

    const emailInput = screen.getByLabelText("Contact Email");
    expect(emailInput).toHaveAttribute("placeholder", "Optional. Replaces login email.");
  });
});
