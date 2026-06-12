import React from "react";
import { render, screen, act } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import DashboardProfilePage from "../app/dashboard/profile/page";
import { useAuth } from "../context/AuthContext";
import { getDoc } from "firebase/firestore";
import * as LucideIcons from "lucide-react";

// Mock AuthContext
vi.mock("../context/AuthContext", () => {
  return {
    useAuth: vi.fn(),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

// Mock Firebase firestore methods
vi.mock("firebase/firestore", () => {
  return {
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
  };
});

describe("DashboardProfilePage imports", () => {
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
      const Icon = (LucideIcons as any)[iconName];
      expect(Icon).toBeDefined();
      expect(typeof Icon).not.toBe("undefined");
    });
  });

  it("renders profile page successfully with loaded profile", async () => {
    (useAuth as any).mockReturnValue({
      user: { uid: "test-uid", displayName: "Test User", email: "test@example.com" },
      authorizedUser: { email: "test@example.com", role: "admin" },
      loading: false,
    });

    const mockDocData = {
      nickname: "Testy",
      firstName: "Test",
      lastName: "User",
      subteams: ["Programming"],
      dietaryRestrictions: ["Vegetarian"],
      colleges: [{ name: "WVU", domain: "wvu.edu", years: "2021-2025", degree: "CS" }],
      employers: [{ name: "NASA", domain: "nasa.gov", title: "Intern", current: true, years: "2024" }]
    };

    (getDoc as any).mockResolvedValue({
      exists: () => true,
      data: () => mockDocData
    });

    await act(async () => {
      render(<DashboardProfilePage />);
    });

    expect(screen.queryByText(/Loading Settings Panel.../i)).not.toBeInTheDocument();
    
    // Check if form is visible by checking for some form text
    expect(screen.getByText(/User Settings/i)).toBeInTheDocument();
  });
});
