import React from "react";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import DashboardProfilePage from "../app/dashboard/profile/page";
import { useAuth } from "../context/AuthContext";
import { authenticatedFetch } from "../lib/api";
import * as LucideIcons from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { User } from "firebase/auth";

// Mock AuthContext
vi.mock("../context/AuthContext", () => {
  return {
    useAuth: vi.fn(),
    useOptionalAuth: () => undefined,
    AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

vi.mock("../lib/api", () => ({
  authenticatedFetch: vi.fn(),
}));

const emptyProfile = {
  nickname: "", firstName: "", lastName: "", pronouns: "", avatar: "", bio: "",
  funFact: "", favoriteFirstThing: "", favoriteRobotMechanism: "",
  preMatchSuperstition: "", rookieYear: "", leadershipRole: "", subteams: [],
  tshirtSize: "", dietaryRestrictions: [], emergencyContactName: "",
  emergencyContactPhone: "", phone: "", contactEmail: "", showEmail: false,
  showPhone: false, showOnAbout: false, colleges: [], employers: [], memberType: "student",
};

function apiResponse(body: unknown, ok = true, status = 200, statusText = "OK") {
  return { ok, status, statusText, json: async () => body } as Response;
}

function testUser(uid: string, displayName: string, email: string): User {
  return { uid, displayName, email } as unknown as User;
}

function mockProfileApi(profile: Record<string, unknown> = {}, exists = true) {
  vi.mocked(authenticatedFetch).mockImplementation(async (_input, init) => {
    const dto = { ...emptyProfile, ...profile };
    return init?.method === "PATCH"
      ? apiResponse({ success: true, exists: true, profile: dto })
      : apiResponse({ exists, profile: dto });
  });
}

function renderProfilePage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardProfilePage />
    </QueryClientProvider>,
  );
}

describe("DashboardProfilePage imports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
    mockProfileApi();
  });

  it("verifies all lucide-react icons used are defined", () => {
    const requiredIcons = [
      "User", 
      "Save", 
      "GraduationCap", 
      "Briefcase", 
      "Plus", 
      "Trash2", 
      "Loader2", 
      "CheckCircle", 
      "AlertTriangle",
      "Info",
      "ChevronRight",
      "Sparkles"
    ];
    
    requiredIcons.forEach(iconName => {
      const Icon = LucideIcons[iconName as keyof typeof LucideIcons];
      expect(Icon).toBeDefined();
      expect(typeof Icon).not.toBe("undefined");
    });
  });

  it("renders profile page successfully with loaded profile", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: testUser("test-uid", "Test User", "test@example.com"),
      authorizedUser: { email: "test@example.com", role: "admin" },
      loading: false,
      authError: null,
      clearAuthError: vi.fn(),
      loginWithGoogle: vi.fn(), logout: vi.fn(), loginWithMockUser: vi.fn(),
    });

    const mockDocData = {
      nickname: "Testy",
      firstName: "Test",
      lastName: "User",
      avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=test",
      subteams: ["Programming"],
      dietaryRestrictions: ["Vegetarian"],
      colleges: [{ name: "WVU", domain: "wvu.edu", years: "2021-2025", degree: "CS" }],
      employers: [{ name: "NASA", domain: "nasa.gov", title: "Intern", current: true, years: "2024" }]
    };

    mockProfileApi(mockDocData);

    await act(async () => {
      renderProfilePage();
    });

    expect(await screen.findByText(/User Settings/i)).toBeInTheDocument();
    expect(screen.queryByText(/Loading Settings Panel.../i)).not.toBeInTheDocument();

    // Verify avatar preview and button exist
    const customizeButton = screen.getByRole("button", { name: /Customize Avatar/i });
    expect(customizeButton).toBeInTheDocument();

    // Open Character Creator modal
    await act(async () => {
      fireEvent.click(customizeButton);
    });

    // Check if the modal title is visible
    expect(screen.getByText(/Character Creator/i)).toBeInTheDocument();

    // Click confirm avatar in character creator to save
    const confirmButton = screen.getByRole("button", { name: /Confirm Avatar/i });
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    // Verify modal is closed
    expect(screen.queryByText(/Character Creator/i)).not.toBeInTheDocument();
  });

  it("keeps a new profile private and does not copy the Google legal name into nickname", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: testUser("new-uid", "Student Legal Name", "student@example.com"),
      authorizedUser: { email: "student@example.com", role: "member" },
      loading: false,
      authError: null,
      clearAuthError: vi.fn(),
      loginWithGoogle: vi.fn(), logout: vi.fn(), loginWithMockUser: vi.fn(),
    });
    mockProfileApi({}, false);

    renderProfilePage();

    await waitFor(() => expect(screen.queryByText(/Loading Settings Panel/i)).not.toBeInTheDocument());
    expect(screen.getByLabelText(/Nickname \*/i)).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: /Contact & Privacy/i }));
    expect(screen.getByLabelText(/Display on Public Roster/i)).not.toBeChecked();
  });

  it("forces legacy student contact visibility flags off when saving", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: testUser("student-uid", "Protected Student", "student@example.com"),
      authorizedUser: { email: "student@example.com", role: "member" },
      loading: false,
      authError: null,
      clearAuthError: vi.fn(),
      loginWithGoogle: vi.fn(), logout: vi.fn(), loginWithMockUser: vi.fn(),
    });
    mockProfileApi({
        nickname: "Student Nickname",
        memberType: "student",
        contactEmail: "student@example.com",
        phone: "304-555-0100",
        showEmail: true,
        showPhone: true,
    });

    renderProfilePage();
    await waitFor(() => expect(screen.queryByText(/Loading Settings Panel/i)).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Save Profile/i }));

    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/profiles/me",
      expect.objectContaining({
        method: "PATCH",
        body: expect.any(String),
      }),
    ));
    const saveInit = vi.mocked(authenticatedFetch).mock.calls.find(([, init]) => init?.method === "PATCH")?.[1];
    const saved = JSON.parse(String(saveInit?.body));
    expect(saved).toEqual(expect.objectContaining({
        nickname: "Student Nickname",
        contactEmail: "student@example.com",
        phone: "304-555-0100",
        showEmail: false,
        showPhone: false,
    }));
    expect(saved).not.toHaveProperty("memberType");
  });

  it("keeps profile edits visible and reports the write error when saving fails", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: testUser("member-uid", "Member", "member@example.com"),
      authorizedUser: { email: "member@example.com", role: "member" },
      loading: false,
      authError: null,
      clearAuthError: vi.fn(),
      loginWithGoogle: vi.fn(), logout: vi.fn(), loginWithMockUser: vi.fn(),
    });
    mockProfileApi({ nickname: "Original", memberType: "student" });
    vi.mocked(authenticatedFetch).mockImplementation(async (_input, init) => init?.method === "PATCH"
      ? apiResponse({ error: "Profile save rejected" }, false, 403, "Forbidden")
      : apiResponse({ exists: true, profile: { ...emptyProfile, nickname: "Original" } }));

    renderProfilePage();
    const nickname = await screen.findByLabelText(/Nickname \*/i);
    fireEvent.change(nickname, { target: { value: "Unsaved Nickname" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Profile/i }));

    expect(await screen.findByText(/HTTP 403: Forbidden.*Profile save rejected/i)).toBeInTheDocument();
    expect(nickname).toHaveValue("Unsaved Nickname");
  });

  it("exercises all profile tabs, input fields, and submits successfully", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: testUser("test-uid", "Test User", "test@example.com"),
      authorizedUser: { email: "test@example.com", role: "admin" },
      loading: false,
      authError: null,
      clearAuthError: vi.fn(),
      loginWithGoogle: vi.fn(), logout: vi.fn(), loginWithMockUser: vi.fn(),
    });

    const mockDocData = {
      nickname: "Testy",
      firstName: "Test",
      lastName: "User",
      avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=test",
      subteams: ["Programming"],
      dietaryRestrictions: ["Vegetarian"],
      colleges: [],
      employers: []
    };

    mockProfileApi(mockDocData);

    await act(async () => {
      renderProfilePage();
    });

    // --- Tab 1: Identity & Bio (Default) ---
    // Change nickname
    const nicknameInput = await screen.findByLabelText(/Nickname \*/i);
    fireEvent.change(nicknameInput, { target: { value: "NewNickname" } });

    // Change biography
    const bioTextarea = screen.getByLabelText(/Biography/i);
    fireEvent.change(bioTextarea, { target: { value: "This is my new biography." } });

    // Change favorite robot mechanism
    const mechInput = screen.getByLabelText(/Favorite Robot Mechanism/i);
    fireEvent.change(mechInput, { target: { value: "Swerve Drive" } });

    // --- Tab 2: Subteams & Roles ---
    const subteamsBtn = screen.getByRole("button", { name: /Subteams & Roles/i });
    await act(async () => {
      fireEvent.click(subteamsBtn);
    });

    // Toggle CAD subteam
    const cadBtn = screen.getByRole("button", { name: /^CAD$/i });
    fireEvent.click(cadBtn);

    // Toggle Programming subteam (which was initially active) to unselect it
    const progBtn = screen.getByRole("button", { name: /^Programming$/i });
    fireEvent.click(progBtn);

    // Change Rookie Year
    const rookieInput = screen.getByLabelText(/Rookie Year/i);
    fireEvent.change(rookieInput, { target: { value: "2023" } });

    // Select Member Type
    const memberTypeSelect = screen.getByLabelText(/Member Type/i);
    fireEvent.change(memberTypeSelect, { target: { value: "mentor" } });

    // --- Tab 3: Education & Career ---
    const careerBtn = screen.getByRole("button", { name: /Education & Career/i });
    await act(async () => {
      fireEvent.click(careerBtn);
    });

    // Add College
    const collegeNameInput = screen.getByLabelText(/College\/University Name/i);
    const collegeDomainInput = screen.getByLabelText(/Web Domain/i, { selector: "#new-col-domain" });
    const collegeDegreeInput = screen.getByLabelText(/Degree \/ Major/i);
    const collegeYearsInput = screen.getByLabelText(/Years Attended/i);
    const addCollegeBtn = screen.getByRole("button", { name: /Add College/i });

    fireEvent.change(collegeNameInput, { target: { value: "WVU" } });
    fireEvent.change(collegeDomainInput, { target: { value: "wvu.edu" } });
    fireEvent.change(collegeDegreeInput, { target: { value: "CS" } });
    fireEvent.change(collegeYearsInput, { target: { value: "2021-2025" } });
    
    await act(async () => {
      fireEvent.click(addCollegeBtn);
    });

    // Add Employer
    const empNameInput = screen.getByLabelText(/Company \/ Organization/i);
    const empDomainInput = screen.getByPlaceholderText(/e.g. nasa.gov/i);
    const empTitleInput = screen.getByLabelText(/Job Title/i);
    const empYearsInput = screen.getByLabelText(/Years Active/i);
    const empCurrentCheckbox = screen.getByLabelText(/Current Employer/i);
    const addEmpBtn = screen.getByRole("button", { name: /Add Employer/i });

    fireEvent.change(empNameInput, { target: { value: "NASA" } });
    fireEvent.change(empDomainInput, { target: { value: "nasa.gov" } });
    fireEvent.change(empTitleInput, { target: { value: "Intern" } });
    fireEvent.change(empYearsInput, { target: { value: "2024" } });
    fireEvent.click(empCurrentCheckbox);

    await act(async () => {
      fireEvent.click(addEmpBtn);
    });

    // Remove college and employer to test removal functions
    const removeCollegeBtns = screen.getAllByRole("button").filter(b => b.innerHTML.includes("svg")); // Trash icon buttons
    // Click remove college
    await act(async () => {
      fireEvent.click(removeCollegeBtns[0]);
    });
    // Click remove employer
    await act(async () => {
      fireEvent.click(removeCollegeBtns[1]);
    });

    // --- Tab 4: Contact & Privacy ---
    const privacyBtn = screen.getByRole("button", { name: /Contact & Privacy/i });
    await act(async () => {
      fireEvent.click(privacyBtn);
    });

    // Change Contact Email
    const contactEmailInput = screen.getByLabelText(/Contact Email/i, { selector: "#profile-contact-email" });
    fireEvent.change(contactEmailInput, { target: { value: "new-contact@team.org" } });

    // Toggle Privacy Checkbox
    const publicRosterCheckbox = screen.getByLabelText(/Display on Public Roster/i);
    fireEvent.click(publicRosterCheckbox);

    // --- Tab 5: Logistics & Safety ---
    const safetyBtn = screen.getByRole("button", { name: /Logistics & Safety/i });
    await act(async () => {
      fireEvent.click(safetyBtn);
    });

    // Select T-shirt Size
    const tshirtSelect = screen.getByLabelText(/T-shirt Size/i);
    fireEvent.change(tshirtSelect, { target: { value: "xl" } });

    // Toggle Dietary Restriction
    const veganBtn = screen.getByRole("button", { name: /^Vegan$/i });
    fireEvent.click(veganBtn);

    // Emergency Contact
    const contactNameInput = screen.getByLabelText(/Emergency Contact Name/i);
    fireEvent.change(contactNameInput, { target: { value: "John Doe" } });

    // --- Submit Profile ---
    const submitBtn = screen.getByRole("button", { name: /Save Profile/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    const finalSave = vi.mocked(authenticatedFetch).mock.calls.find(([, init]) => init?.method === "PATCH")?.[1];
    expect(JSON.parse(String(finalSave?.body))).toEqual(
      expect.objectContaining({
        nickname: "NewNickname",
        showOnAbout: true,
        showEmail: false,
        showPhone: false,
      }),
    );
    expect(screen.getByText(/Profile settings saved securely/i)).toBeInTheDocument();
  }, 15000);
});
