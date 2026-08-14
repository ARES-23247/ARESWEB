import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AcademyWorkshopsPage from "@/app/academy/workshops/page";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { getAppCheckHeader } from "@/lib/firebaseAppCheck";
import {
  WORKSHOP_MODULES,
  WORKSHOP_CATEGORIES,
  GRADE_LEVELS,
  EXPERIENCE_LEVELS,
  MENTOR_SKILL_TAGS,
  filterWorkshops,
  getWorkshopById,
  getWorkshopSession,
  isValidEmail,
  validateStudentRegistration,
  validateMentorSignup,
  type StudentRegistration,
  type MentorShiftSignup,
} from "@/lib/workshopCurriculumData";

// Mock reCAPTCHA and App Check
vi.mock("@/lib/recaptcha", () => ({
  getRecaptchaToken: vi.fn(),
}));

vi.mock("@/lib/firebaseAppCheck", () => ({
  getAppCheckHeader: vi.fn(),
}));

describe("STEM Workshop Curriculum Data Models & Helper Functions", () => {
  it("defines all four required core curriculum modules", () => {
    expect(WORKSHOP_MODULES).toHaveLength(4);

    const categories = WORKSHOP_MODULES.map((m) => m.category);
    expect(categories).toContain("cad");
    expect(categories).toContain("programming");
    expect(categories).toContain("motion-control");
    expect(categories).toContain("electrical");

    expect(WORKSHOP_CATEGORIES).toHaveLength(4);
    expect(GRADE_LEVELS.length).toBeGreaterThanOrEqual(6);
    expect(EXPERIENCE_LEVELS.length).toBeGreaterThanOrEqual(4);
    expect(MENTOR_SKILL_TAGS.length).toBeGreaterThanOrEqual(8);
  });

  describe("filterWorkshops", () => {
    it("returns all modules when filter is set to all", () => {
      const result = filterWorkshops(WORKSHOP_MODULES, { category: "all", level: "all" });
      expect(result).toHaveLength(4);
    });

    it("filters modules by specific category", () => {
      const cadOnly = filterWorkshops(WORKSHOP_MODULES, { category: "cad" });
      expect(cadOnly).toHaveLength(1);
      expect(cadOnly[0].id).toBe("cad-onshape");

      const progOnly = filterWorkshops(WORKSHOP_MODULES, { category: "programming" });
      expect(progOnly).toHaveLength(1);
      expect(progOnly[0].id).toBe("prog-ftc-java");
    });

    it("filters modules by difficulty level", () => {
      const beginner = filterWorkshops(WORKSHOP_MODULES, { level: "Beginner" });
      expect(beginner).toHaveLength(1);
      expect(beginner[0].id).toBe("elec-prototyping");

      const advanced = filterWorkshops(WORKSHOP_MODULES, { level: "Advanced" });
      expect(advanced).toHaveLength(1);
      expect(advanced[0].id).toBe("motion-control-pid");
    });

    it("filters modules by search query over title, topics, and software", () => {
      const onshapeSearch = filterWorkshops(WORKSHOP_MODULES, { search: "Onshape" });
      expect(onshapeSearch).toHaveLength(1);
      expect(onshapeSearch[0].id).toBe("cad-onshape");

      const pidSearch = filterWorkshops(WORKSHOP_MODULES, { search: "Feedforward" });
      expect(pidSearch).toHaveLength(1);
      expect(pidSearch[0].id).toBe("motion-control-pid");

      const canBusSearch = filterWorkshops(WORKSHOP_MODULES, { search: "CAN Bus" });
      expect(canBusSearch).toHaveLength(1);
      expect(canBusSearch[0].id).toBe("elec-prototyping");

      const emptySearch = filterWorkshops(WORKSHOP_MODULES, { search: "NonExistentTechnology999" });
      expect(emptySearch).toHaveLength(0);
    });
  });

  describe("getWorkshopById and getWorkshopSession", () => {
    it("retrieves workshop by ID or slug", () => {
      const byId = getWorkshopById("cad-onshape");
      expect(byId).toBeDefined();
      expect(byId?.title).toContain("3D CAD Modeling");

      const bySlug = getWorkshopById("ftc-robot-programming-java-kotlin");
      expect(bySlug).toBeDefined();
      expect(bySlug?.category).toBe("programming");

      const notFound = getWorkshopById("invalid-id");
      expect(notFound).toBeUndefined();
    });

    it("retrieves specific workshop session", () => {
      const result = getWorkshopSession("cad-onshape", "cad-sess-1");
      expect(result).toBeDefined();
      expect(result?.workshop.id).toBe("cad-onshape");
      expect(result?.session.id).toBe("cad-sess-1");
      expect(result?.session.availableSeats).toBe(8);

      const invalidSession = getWorkshopSession("cad-onshape", "invalid-sess");
      expect(invalidSession).toBeUndefined();

      const invalidWorkshop = getWorkshopSession("invalid-ws", "cad-sess-1");
      expect(invalidWorkshop).toBeUndefined();
    });
  });

  describe("isValidEmail", () => {
    it("validates RFC 5322 email syntax", () => {
      expect(isValidEmail("parent@example.com")).toBe(true);
      expect(isValidEmail("mentor.coach+ftc@domain.org")).toBe(true);
      expect(isValidEmail("invalid-email")).toBe(false);
      expect(isValidEmail("")).toBe(false);
      expect(isValidEmail("   ")).toBe(false);
    });
  });

  describe("validateStudentRegistration", () => {
    const validStudent: StudentRegistration = {
      studentNickname: "AresLead",
      parentGuardianName: "Jane Doe",
      parentGuardianEmail: "jane@example.com",
      parentGuardianPhone: "304-555-0100",
      gradeLevel: "10th Grade (Sophomore)",
      priorExperience: "Intermediate (1-2 Years FTC/FRC)",
      dietaryOrAccessibilityNeeds: "None",
      workshopId: "cad-onshape",
      sessionId: "cad-sess-1",
      yppParentConsent: true,
      photoConsent: false,
    };

    it("accepts a completely valid student registration", () => {
      const res = validateStudentRegistration(validStudent);
      expect(res.isValid).toBe(true);
      expect(res.errors).toEqual({});
    });

    it("fails when student nickname is missing or exceeds 50 chars", () => {
      const emptyNick = validateStudentRegistration({ ...validStudent, studentNickname: "" });
      expect(emptyNick.isValid).toBe(false);
      expect(emptyNick.errors.studentNickname).toBeDefined();

      const longNick = validateStudentRegistration({ ...validStudent, studentNickname: "a".repeat(55) });
      expect(longNick.isValid).toBe(false);
      expect(longNick.errors.studentNickname).toContain("50 characters");
    });

    it("fails when parent name, email, or phone is missing or invalid", () => {
      const noParentName = validateStudentRegistration({ ...validStudent, parentGuardianName: "  " });
      expect(noParentName.isValid).toBe(false);
      expect(noParentName.errors.parentGuardianName).toBeDefined();

      const invalidEmail = validateStudentRegistration({ ...validStudent, parentGuardianEmail: "not-an-email" });
      expect(invalidEmail.isValid).toBe(false);
      expect(invalidEmail.errors.parentGuardianEmail).toBeDefined();

      const noPhone = validateStudentRegistration({ ...validStudent, parentGuardianPhone: "" });
      expect(noPhone.isValid).toBe(false);
      expect(noPhone.errors.parentGuardianPhone).toBeDefined();
    });

    it("strictly requires FIRST® YPP parent/guardian consent", () => {
      const noYppConsent = validateStudentRegistration({ ...validStudent, yppParentConsent: false });
      expect(noYppConsent.isValid).toBe(false);
      expect(noYppConsent.errors.yppParentConsent).toContain("FIRST® Youth Protection Program (YPP)");
    });

    it("fails when grade level, experience, or workshop session is missing", () => {
      const missingFields = validateStudentRegistration({
        studentNickname: "Test",
        parentGuardianName: "Parent",
        parentGuardianEmail: "p@example.com",
        parentGuardianPhone: "123",
        yppParentConsent: true,
      });
      expect(missingFields.isValid).toBe(false);
      expect(missingFields.errors.gradeLevel).toBeDefined();
      expect(missingFields.errors.priorExperience).toBeDefined();
      expect(missingFields.errors.workshopId).toBeDefined();
      expect(missingFields.errors.sessionId).toBeDefined();
    });
  });

  describe("validateMentorSignup", () => {
    const validMentor: MentorShiftSignup = {
      name: "Alex Smith",
      email: "alex.mentor@example.com",
      phone: "304-555-0200",
      workshopId: "prog-ftc-java",
      sessionId: "prog-sess-1",
      role: "mentor",
      skills: ["FTC Java / Kotlin", "PID & Feedforward Tuning"],
      availabilityNotes: "Available for Saturday morning sessions.",
    };

    it("accepts a completely valid mentor shift registration", () => {
      const res = validateMentorSignup(validMentor);
      expect(res.isValid).toBe(true);
      expect(res.errors).toEqual({});
    });

    it("fails when mentor name or email is missing/invalid", () => {
      const noName = validateMentorSignup({ ...validMentor, name: "" });
      expect(noName.isValid).toBe(false);
      expect(noName.errors.name).toBeDefined();

      const badEmail = validateMentorSignup({ ...validMentor, email: "invalid" });
      expect(badEmail.isValid).toBe(false);
      expect(badEmail.errors.email).toBeDefined();
    });

    it("fails when workshop or session or skills are empty", () => {
      const noSkills = validateMentorSignup({ ...validMentor, skills: [] });
      expect(noSkills.isValid).toBe(false);
      expect(noSkills.errors.skills).toBeDefined();

      const noSession = validateMentorSignup({ ...validMentor, sessionId: "" });
      expect(noSession.isValid).toBe(false);
      expect(noSession.errors.sessionId).toBeDefined();
    });
  });
});

describe("STEM Workshop Portal Component (<AcademyWorkshopsPage />)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    vi.mocked(getRecaptchaToken).mockResolvedValue("mock-recaptcha-token");
    vi.mocked(getAppCheckHeader).mockResolvedValue({ "X-Firebase-AppCheck": "mock-appcheck-token" });
  });

  it("renders page header, metrics, zero PII notice, and all 4 workshop modules", () => {
    render(
      <MemoryRouter>
        <AcademyWorkshopsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: /STEM Workshop Curriculum & Coaching/i })).toBeInTheDocument();
    expect(screen.getByText(/4 Specialized Tracks/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Zero Student PII/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/FIRST® YPP/i).length).toBeGreaterThanOrEqual(1);

    expect(screen.getByRole("heading", { name: /3D CAD Modeling & Parametric Mechanism Design/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /FTC Robot Programming with Java & Kotlin/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Motion Control & Feedback Loops: PID, Feedforward, & Odometry/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Electrical Prototyping, Power Distribution, & CAN Bus Architecture/i })).toBeInTheDocument();
  });

  it("filters workshops interactively when category tab is selected", async () => {
    render(
      <MemoryRouter>
        <AcademyWorkshopsPage />
      </MemoryRouter>
    );

    const cadTab = screen.getByRole("tab", { name: /3D CAD Modeling/i });
    fireEvent.click(cadTab);

    expect(screen.getByRole("heading", { name: /3D CAD Modeling & Parametric Mechanism Design/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /FTC Robot Programming with Java & Kotlin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Electrical Prototyping, Power Distribution/i })).not.toBeInTheDocument();

    const allTab = screen.getByRole("tab", { name: /All Modules/i });
    fireEvent.click(allTab);
    expect(screen.getByRole("heading", { name: /FTC Robot Programming with Java & Kotlin/i })).toBeInTheDocument();
  });

  it("filters workshops by search query and shows reset empty state", async () => {
    render(
      <MemoryRouter>
        <AcademyWorkshopsPage />
      </MemoryRouter>
    );

    const searchInput = screen.getByLabelText(/Search workshop curriculum/i);
    fireEvent.change(searchInput, { target: { value: "Feedforward" } });

    expect(screen.getByRole("heading", { name: /Motion Control & Feedback Loops/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /3D CAD Modeling & Parametric/i })).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "NonExistentTechnologyXYZ" } });
    expect(screen.getByText(/No Matching Workshops Found/i)).toBeInTheDocument();

    const resetButton = screen.getByRole("button", { name: /Reset Filters/i });
    fireEvent.click(resetButton);
    expect(screen.getByRole("heading", { name: /3D CAD Modeling & Parametric Mechanism Design/i })).toBeInTheDocument();
  });

  it("opens student pre-registration modal and validates required fields & YPP consent", async () => {
    render(
      <MemoryRouter>
        <AcademyWorkshopsPage />
      </MemoryRouter>
    );

    const preRegButtons = screen.getAllByRole("button", { name: /Pre-Register Student/i });
    fireEvent.click(preRegButtons[0]);

    expect(screen.getByRole("dialog", { name: /Register for Hands-On Coaching/i })).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /Submit Pre-Registration/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Student nickname or callsign is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Parent or guardian name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Parent or guardian email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Parent\/Guardian consent under FIRST® Youth Protection Program/i)).toBeInTheDocument();
    });
  });

  it("successfully submits student pre-registration with App Check, reCAPTCHA, and YPP consent", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, id: "inq_test_student_123" }),
    } as Response);

    render(
      <MemoryRouter>
        <AcademyWorkshopsPage />
      </MemoryRouter>
    );

    const preRegButtons = screen.getAllByRole("button", { name: /Pre-Register Student/i });
    fireEvent.click(preRegButtons[0]);

    fireEvent.change(screen.getByLabelText(/Student Nickname \/ Callsign/i), { target: { value: "AresCadet" } });
    fireEvent.change(screen.getByLabelText(/Grade Level/i), { target: { value: "10th Grade (Sophomore)" } });
    fireEvent.change(screen.getByLabelText(/Prior Robotics \/ Programming Experience/i), {
      target: { value: "Novice (FLL / Middle School STEM)" },
    });
    fireEvent.change(screen.getByLabelText(/Parent \/ Guardian Name/i), { target: { value: "Sarah Connor" } });
    fireEvent.change(screen.getByLabelText(/Parent \/ Guardian Email/i), { target: { value: "sarah@cyberdyne.org" } });
    fireEvent.change(screen.getByLabelText(/Parent \/ Guardian Phone Number/i), { target: { value: "304-555-0144" } });
    fireEvent.change(screen.getByLabelText(/Dietary or Accessibility Accommodations/i), { target: { value: "None needed." } });

    const yppCheckbox = screen.getByRole("checkbox", { name: /FIRST® Youth Protection Program \(YPP\) Consent/i });
    fireEvent.click(yppCheckbox);

    const submitBtn = screen.getByRole("button", { name: /Submit Pre-Registration/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const [url, requestInit] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe("/api/inquiries");
    expect(requestInit?.method).toBe("POST");

    const parsedBody = JSON.parse(requestInit?.body as string);
    expect(parsedBody.type).toBe("student");
    expect(parsedBody.name).toBe("Sarah Connor");
    expect(parsedBody.email).toBe("sarah@cyberdyne.org");
    expect(parsedBody.recaptchaToken).toBe("mock-recaptcha-token");
    expect(parsedBody.metadata.studentNickname).toBe("AresCadet");
    expect(parsedBody.metadata.yppParentConsent).toBe(true);

    expect(await screen.findByText(/Pre-Registration Confirmed!/i)).toBeInTheDocument();
  });

  it("handles student registration submission error gracefully", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, error: "Server rate limit exceeded. Please try again later." }),
    } as Response);

    render(
      <MemoryRouter>
        <AcademyWorkshopsPage />
      </MemoryRouter>
    );

    const preRegButtons = screen.getAllByRole("button", { name: /Pre-Register Student/i });
    fireEvent.click(preRegButtons[0]);

    fireEvent.change(screen.getByLabelText(/Student Nickname \/ Callsign/i), { target: { value: "AresCadet" } });
    fireEvent.change(screen.getByLabelText(/Grade Level/i), { target: { value: "9th Grade (Freshman)" } });
    fireEvent.change(screen.getByLabelText(/Prior Robotics \/ Programming Experience/i), {
      target: { value: "Beginner / Curious Explorer" },
    });
    fireEvent.change(screen.getByLabelText(/Parent \/ Guardian Name/i), { target: { value: "John Doe" } });
    fireEvent.change(screen.getByLabelText(/Parent \/ Guardian Email/i), { target: { value: "john@example.com" } });
    fireEvent.change(screen.getByLabelText(/Parent \/ Guardian Phone Number/i), { target: { value: "304-555-0122" } });

    const yppCheckbox = screen.getByRole("checkbox", { name: /FIRST® Youth Protection Program \(YPP\) Consent/i });
    fireEvent.click(yppCheckbox);

    const submitBtn = screen.getByRole("button", { name: /Submit Pre-Registration/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Server rate limit exceeded/i)).toBeInTheDocument();
  });

  it("opens mentor sign-up modal, toggles skills, and submits volunteer shift", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, id: "inq_mentor_456" }),
    } as Response);

    render(
      <MemoryRouter>
        <AcademyWorkshopsPage />
      </MemoryRouter>
    );

    const mentorButtons = screen.getAllByRole("button", { name: /Volunteer as Coach \/ Mentor|Mentor Shift/i });
    fireEvent.click(mentorButtons[0]);

    expect(screen.getByRole("dialog", { name: /Mentor & Alumni Sign-Up/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Grace Hopper" } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "grace.hopper@navy.mil" } });
    fireEvent.change(screen.getByLabelText(/Role Type/i), { target: { value: "alumni" } });

    // Toggle skills
    const cadSkill = screen.getByRole("button", { name: /\+ Onshape 3D CAD/i });
    fireEvent.click(cadSkill);
    expect(screen.getByRole("button", { name: /✓ Onshape 3D CAD/i })).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /Confirm Mentor Shift/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const [url, requestInit] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe("/api/inquiries");
    const parsedBody = JSON.parse(requestInit?.body as string);
    expect(parsedBody.type).toBe("mentor");
    expect(parsedBody.name).toBe("Grace Hopper");
    expect(parsedBody.metadata.skills).toContain("Onshape 3D CAD");

    expect(await screen.findByText(/Mentor Shift Confirmed!/i)).toBeInTheDocument();
  });
});