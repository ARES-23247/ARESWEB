import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemberCard, TeamMember } from "./MemberCard";

// Mock @tanstack/react-router Link
vi.mock("@tanstack/react-router", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Link: ({ children, to, params, className }: any) => {
    let href = to;
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        href = href.replace(`$${key}`, value as string);
      });
    }
    return <a href={href} className={className}>{children}</a>;
  }
}));

// Mock BrandLogo component
vi.mock("./BrandLogo", () => ({
  BrandLogo: ({ domain, className }: { domain: string; className?: string }) => (
    <div data-testid="brand-logo" data-domain={domain} className={className}>
      Logo
    </div>
  ),
  ...vi.importActual("./BrandLogo"),
}));

const mockMember: TeamMember = {
  user_id: "123",
  nickname: "TestUser",
  name: "Test User",
  avatar: "https://example.com/avatar.png",
  pronouns: "they/them",
  subteams: '["Software", "Electronics"]',
  member_type: "student",
  bio: "Test bio",
  fun_fact: "Loves robotics",
  favorite_first_thing: "Building",
  colleges: '[{"domain": "wvu.edu"}]',
  employers: null,
};

const mockMemberWithArraySubteams: TeamMember = {
  ...mockMember,
  subteams: ["Software", "Electronics"],
};

const mockMemberWithArrayColleges: TeamMember = {
  ...mockMember,
  member_type: "alumni",
  colleges: [{ domain: "wvu.edu" }, { domain: "cmu.edu" }],
};

const mockAlumniMember: TeamMember = {
  user_id: "456",
  nickname: "AlumniUser",
  avatar: "",
  pronouns: null,
  subteams: null,
  member_type: "alumni",
  colleges: '[{"domain": "mit.edu"}]',
  employers: null,
  name: null,
  bio: null,
  fun_fact: null,
  favorite_first_thing: null,
};

const mockMemberWithNoSubteams: TeamMember = {
  ...mockMember,
  subteams: null,
};

describe("MemberCard Component", () => {
  const renderWithRouter = (component: React.ReactElement) => {
    return render(component);
  };

  it("renders member information correctly", () => {
    renderWithRouter(<MemberCard member={mockMember} />);

    expect(screen.getByText("TestUser")).toBeInTheDocument();
    expect(screen.getByText("they/them")).toBeInTheDocument();
  });

  it("falls back to name when nickname is not available", () => {
    const memberWithoutNickname = { ...mockMember, nickname: "" };
    renderWithRouter(<MemberCard member={memberWithoutNickname} />);

    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("falls back to default text when both nickname and name are unavailable", () => {
    const memberWithoutNames = {
      ...mockMember,
      nickname: "",
      name: null,
    };
    renderWithRouter(<MemberCard member={memberWithoutNames} />);

    expect(screen.getByText("ARES Member")).toBeInTheDocument();
  });

  it("does not render pronouns when not provided", () => {
    const memberWithoutPronouns = { ...mockMember, pronouns: null };
    renderWithRouter(<MemberCard member={memberWithoutPronouns} />);

    expect(screen.queryByText(/they\/them/)).not.toBeInTheDocument();
  });

  it("parses subteams from JSON string", () => {
    renderWithRouter(<MemberCard member={mockMember} />);

    expect(screen.getByText("Software")).toBeInTheDocument();
    expect(screen.getByText("Electronics")).toBeInTheDocument();
  });

  it("handles subteams as array", () => {
    renderWithRouter(<MemberCard member={mockMemberWithArraySubteams} />);

    expect(screen.getByText("Software")).toBeInTheDocument();
    expect(screen.getByText("Electronics")).toBeInTheDocument();
  });

  it("does not render subteams section when subteams is null or empty", () => {
    renderWithRouter(<MemberCard member={mockMemberWithNoSubteams} />);

    // Should not have any subteam badges
    const subteamBadges = screen.queryAllByText(/Software|Electronics|Mechanical/);
    expect(subteamBadges.length).toBe(0);
  });

  it("parses empty subteams JSON string", () => {
    const memberWithEmptySubteams = {
      ...mockMember,
      subteams: "[]",
    };
    const { container } = renderWithRouter(<MemberCard member={memberWithEmptySubteams} />);

    // Should not render any subteam badges
    const badges = container.querySelectorAll('.bg-ares-red\\/20');
    expect(badges.length).toBe(0);
  });

  it("limits subteams display to 3 items", () => {
    const memberWithManySubteams: TeamMember = {
      ...mockMember,
      subteams: ["Software", "Electronics", "Mechanical", "Business", "Design"],
    };
    renderWithRouter(<MemberCard member={memberWithManySubteams} />);

    expect(screen.getByText("Software")).toBeInTheDocument();
    expect(screen.getByText("Electronics")).toBeInTheDocument();
    expect(screen.getByText("Mechanical")).toBeInTheDocument();
    expect(screen.queryByText("Business")).not.toBeInTheDocument();
    expect(screen.queryByText("Design")).not.toBeInTheDocument();
  });

  it("does not show colleges for non-alumni members", () => {
    renderWithRouter(<MemberCard member={mockMember} />);

    expect(screen.queryByTestId("brand-logo")).not.toBeInTheDocument();
  });

  it("shows colleges for alumni members", () => {
    renderWithRouter(<MemberCard member={mockAlumniMember} />);

    const logos = screen.getAllByTestId("brand-logo");
    expect(logos.length).toBeGreaterThan(0);
    expect(logos[0]).toHaveAttribute("data-domain", "mit.edu");
  });

  it("parses colleges from JSON string for alumni", () => {
    const alumniWithJsonColleges = {
      ...mockMember,
      member_type: "alumni" as const,
      colleges: '[{"domain": "wvu.edu"}, {"domain": "cmu.edu"}]',
    };
    renderWithRouter(<MemberCard member={alumniWithJsonColleges} />);

    const logos = screen.getAllByTestId("brand-logo");
    expect(logos.length).toBe(2);
    expect(logos[0]).toHaveAttribute("data-domain", "wvu.edu");
    expect(logos[1]).toHaveAttribute("data-domain", "cmu.edu");
  });

  it("handles colleges as array for alumni", () => {
    renderWithRouter(<MemberCard member={mockMemberWithArrayColleges} />);

    const logos = screen.getAllByTestId("brand-logo");
    expect(logos.length).toBe(2);
    expect(logos[0]).toHaveAttribute("data-domain", "wvu.edu");
    expect(logos[1]).toHaveAttribute("data-domain", "cmu.edu");
  });

  it("limits colleges display to 3 items", () => {
    const alumniWithManyColleges: TeamMember = {
      ...mockMember,
      member_type: "alumni" as const,
      colleges: [
        { domain: "mit.edu" },
        { domain: "stanford.edu" },
        { domain: "cmu.edu" },
        { domain: "gatech.edu" },
      ],
    };
    renderWithRouter(<MemberCard member={alumniWithManyColleges} />);

    const logos = screen.getAllByTestId("brand-logo");
    expect(logos.length).toBe(3);
  });

  it("does not show colleges when colleges array is empty", () => {
    const alumniWithNoColleges: TeamMember = {
      ...mockMember,
      member_type: "alumni" as const,
      colleges: [],
    };
    renderWithRouter(<MemberCard member={alumniWithNoColleges} />);

    expect(screen.queryByTestId("brand-logo")).not.toBeInTheDocument();
  });

  it("uses fallback avatar when avatar is empty", () => {
    const { container } = renderWithRouter(<MemberCard member={mockAlumniMember} />);

    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", expect.stringContaining("dicebear"));
  });

  it("uses provided avatar when available", () => {
    const { container } = renderWithRouter(<MemberCard member={mockMember} />);

    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://example.com/avatar.png");
  });

  it("links to member profile page", () => {
    renderWithRouter(<MemberCard member={mockMember} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/profile/123");
  });

  it("has proper hover classes for interactivity", () => {
    const { container } = renderWithRouter(<MemberCard member={mockMember} />);

    const link = container.querySelector("a");
    expect(link).toHaveClass("group");

    // The hover classes are on the inner hero-card div, not the link
    const card = container.querySelector(".hero-card");
    expect(card).toHaveClass("group-hover:border-ares-red/30");
    expect(card).toHaveClass("group-hover:shadow-lg");
  });

  it("renders ares-cut styled avatar container", () => {
    const { container } = renderWithRouter(<MemberCard member={mockMember} />);

    const avatarContainer = container.querySelector(".ares-cut");
    expect(avatarContainer).toBeInTheDocument();
  });
});

