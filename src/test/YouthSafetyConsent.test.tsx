import { render, screen, fireEvent, waitFor} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach,
vi } from "vitest";
import PrivacyPage from "../app/privacy/page";
import JoinPage from "../app/join/page";
import AboutPage from "../app/about/page";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { getAppCheckHeader } from "@/lib/firebaseAppCheck";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/GreekMeander", () => ({ GreekMeander: () => null }));
vi.mock("@/lib/recaptcha", () => ({
  getRecaptchaToken: vi.fn(),
}));
vi.mock("@/lib/firebaseAppCheck", () => ({
  getAppCheckHeader: vi.fn(),
}));


function jsonResponse(body: unknown, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}


describe("Youth Safety & Digital Media Consent (FIRST YPP & COPPA)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.mocked(getRecaptchaToken).mockResolvedValue("mock-recaptcha-token");
    vi.mocked(getAppCheckHeader).mockResolvedValue({ "X-Firebase-AppCheck": "mock-appcheck-token" });
  });

  describe("Privacy Policy Disclosures & Parental Consent", () => {
    it("discloses COPPA: compliance and mandatory legal guardian written consent for media release", () => {
      render(
        <MemoryRouter>
          <PrivacyPage />
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: /COPPA & Student Privacy/i })).toBeInTheDocument();
      expect(screen.getByText(/Children's Online Privacy Protection Act/i)).toBeInTheDocument();
      expect(screen.getByText(/collect personal information from general web portal visitors/i)).toBeInTheDocument();

      expect(
        screen.getByText(/Robotics team member names, photographs, and media are only published with explicit written consent and release forms signed by legal guardians/i)
      ).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Cookie-Free Web Analytics/i })).toBeInTheDocument();
      expect(screen.getByText(/explicitly disabled HTTP cookie storage/i)).toBeInTheDocument();
      expect(screen.getByText(/No unique user IP addresses are stored or permanently tracked/i)).toBeInTheDocument();

      expect(screen.getByRole("heading", { name: /Secure AI Processing/i })).toBeInTheDocument();
      expect(screen.getByText(/raw data is never sold, shared, or used to train other AI/i)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Secure Administration/i })).toBeInTheDocument();
    });
  });

  describe("Student Join Intake & FIRST YPP Compliance", () => {
    it("displays FIRST YPP protection disclosure and validates student application form", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, message: "Application submitted successfully." }));
      vi.stubGlobal("fetch", fetchMock);

      render(
        <MemoryRouter>
          <JoinPage />
        </MemoryRouter>
      );

      expect(
        screen.getByText(/Youth Protection Program/i)
      ).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText(/Full Name \*/i), { target: { value: "Jordan Rivers" } });
      fireEvent.change(screen.getByLabelText(/Email Address \*/i), { target: { value: "jordan@example.com" } });
      fireEvent.change(screen.getByLabelText(/School \*/i), { target: { value: "Morgantown High School" } });
      fireEvent.change(screen.getByLabelText(/Current Grade \*/i), { target: { value: "10" } });
      fireEvent.change(screen.getByLabelText(/Phone Number \(Optional\)/i), { target: { value: "304-555-0144" } });

      fireEvent.click(screen.getByLabelText(/Programming/i));
      fireEvent.click(screen.getByLabelText(/Mechanical \/ CAD/i));

      fireEvent.change(screen.getByLabelText(/Additional Information/i), {
        target: { value: "Interested in autonomous path planning and computer vision." },
      });

      fireEvent.click(screen.getByRole("button", { name: /Submit Student Application/i }));

      await waitFor(() => {
        expect(screen.getByText(/Application submitted successfully! We'll be in touch soon/i)).toBeInTheDocument();
      });

      expect(fetchMock).toHaveBeenCalledWith("/api/inquiries", expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Firebase-AppCheck": "mock-appcheck-token",
        }),
        body: JSON.stringify({
          type: "student",
          name: "Jordan Rivers",
          email: "jordan@example.com",
          metadata: {
            school: "Morgantown High School",
            grade: "10",
            interests: ["Programming", "Mechanical / CAD"],
            additional: "Interested in autonomous path planning and computer vision.",
            phone: "304-555-0144",
          },
          recaptchaToken: "mock-recaptcha-token",
        }),
      }));
    });

    it("prevents submission and displays validation error when mandatory student fields are missing", async () => {
      render(
        <MemoryRouter>
          <JoinPage />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Full Name \*/i), { target: { value: "Alex Student" } });
      fireEvent.change(screen.getByLabelText(/Email Address \*/i), { target: { value: "alex@example.com" } });

      const form = screen.getByRole("button", { name: /Submit Student Application/i }).closest("form")!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/Please complete school and grade fields/i);
      });
    });

    it("requires at least one interest selection before student submission", async () => {
      render(
        <MemoryRouter>
          <JoinPage />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Full Name \*/i), { target: { value: "Alex Student" } });
      fireEvent.change(screen.getByLabelText(/Email Address \*/i), { target: { value: "alex@example.com" } });
      fireEvent.change(screen.getByLabelText(/School \*/i), { target: { value: "Suncrest Middle" } });
      fireEvent.change(screen.getByLabelText(/Current Grade \*/i), { target: { value: "8" } });

      const form = screen.getByRole("button", { name: /Submit Student Application/i }).closest("form")!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/Please select at least one interest or area of expertise/i);
      });
    });

    it("handles recruitment inquiry submission errors without crashing", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: false, error: "Spam check failed." }, 400));
      vi.stubGlobal("fetch", fetchMock);

      render(
        <MemoryRouter>
          <JoinPage />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Full Name \*/i), { target: { value: "Alex Student" } });
      fireEvent.change(screen.getByLabelText(/Email Address \*/i), { target: { value: "alex@example.com" } });
      fireEvent.change(screen.getByLabelText(/School \*/i), { target: { value: "Morgantown High" } });
      fireEvent.change(screen.getByLabelText(/Current Grade \*/i), { target: { value: "9" } });
      fireEvent.click(screen.getByLabelText(/Programming/i));

      const form = screen.getByRole("button", { name: /Submit Student Application/i }).closest("form")!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/Spam check failed/i);
      });
    });
  });

  describe("Strict Student Zero-PII Roster Boundaries", () => {
    const mockRosterData = {
      members: [
        {
          nickname: "ShadowCoder",
          firstName: "PrivateStudentFirstName",
          lastName: "PrivateStudentLastName",
          email: "student-private@aresfirst.org",
          contactEmail: "student-private@aresfirst.org",
          phone: "304-555-9999",
          pronouns: "they/them",
          subteams: ["Programming", "Telemetry"],
          memberType: "student" as const,
          avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=student1",
          bio: "Private high school student bio with identifying school details.",
          funFact: "Private fun fact.",
          colleges: ["Future College"],
        },
        {
          nickname: "Coach Sarah",
          pronouns: "she/her",
          subteams: ["Strategy", "Drive Practice"],
          memberType: "coach" as const,
          avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=coach1",
          bio: "Veteran robotics mentor and lead system engineer.",
          colleges: ["MIT Mechanical Engineering"],
        },
        {
          nickname: "NoAvatarStudent",
          memberType: "student" as const,
          avatar: "",
        },
        {
          nickname: "UnsafeAvatarStudent",
          memberType: "student" as const,
          avatar: "http://insecure-http-site.com/avatar.jpg",
        },
      ],
    };

    it("strictly suppresses student PII, subteams, pronouns, bio, and colleges on public roster cards", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(mockRosterData)));

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      expect(await screen.findByRole("heading", { name: "ShadowCoder" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Coach Sarah" })).toBeInTheDocument();

      const studentBadges = screen.getAllByText("student");
      expect(studentBadges.length).toBeGreaterThanOrEqual(1);

      expect(screen.queryByText("PrivateStudentFirstName")).not.toBeInTheDocument();
      expect(screen.queryByText("PrivateStudentLastName")).not.toBeInTheDocument();
      expect(screen.queryByText("student-private@aresfirst.org")).not.toBeInTheDocument();
      expect(screen.queryByText("304-555-9999")).not.toBeInTheDocument();
      expect(screen.queryByText("Private high school student bio with identifying school details.")).not.toBeInTheDocument();
      expect(screen.queryByText("Private fun fact.")).not.toBeInTheDocument();
      expect(screen.queryByText("Future College")).not.toBeInTheDocument();

      expect(screen.queryByText("(they/them)")).not.toBeInTheDocument();
      expect(screen.queryByText("Telemetry")).not.toBeInTheDocument();

      expect(screen.getByText("(she/her)")).toBeInTheDocument();
      expect(screen.getByText("Veteran robotics mentor and lead system engineer.")).toBeInTheDocument();
      expect(screen.getByText("Strategy")).toBeInTheDocument();
    });

    it("renders accessible fallback placeholder when student avatar is missing or invalid", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(mockRosterData)));

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      expect(await screen.findByRole("heading", { name: "NoAvatarStudent" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "UnsafeAvatarStudent" })).toBeInTheDocument();

      const fallbackAvatars = screen.getAllByLabelText("Approved avatar not provided");
      expect(fallbackAvatars.length).toBeGreaterThanOrEqual(2);

      const unsafeImg = screen.queryByRole("img", { name: /UnsafeAvatarStudent's approved avatar/i });
      expect(unsafeImg).not.toBeInTheDocument();
    });

    it("filters to student roster view accurately without leaking data", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(mockRosterData)));

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      expect(await screen.findByRole("heading", { name: "ShadowCoder" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Students/i }));

      expect(screen.getByRole("heading", { name: "ShadowCoder" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "NoAvatarStudent" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Coach Sarah" })).not.toBeInTheDocument();
    });
  });
});
