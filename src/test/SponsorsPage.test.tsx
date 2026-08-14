import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SponsorsPage from "../app/sponsors/page";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/lib/recaptcha", () => ({
  getRecaptchaToken: () => Promise.resolve("mock-recaptcha-token"),
}));
vi.mock("@/lib/firebaseAppCheck", () => ({
  getAppCheckHeader: vi.fn().mockImplementation(() => Promise.resolve({ "X-Firebase-AppCheck": "mock-app-check" })),
}));

function response(body: unknown, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SponsorsPage />
    </MemoryRouter>
  );
}

describe("SponsorsPage partnership matrix and truthfulness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays the partnership tiers and benefits matrix", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ sponsors: [] })));
    renderPage();

    expect(await screen.findByRole("heading", { name: "Sponsorship Opportunities" })).toBeInTheDocument();
    expect(screen.getByText("$5,000+")).toBeInTheDocument();
    expect(screen.getByText("$2,500+")).toBeInTheDocument();
    expect(screen.getByText("$1,000+")).toBeInTheDocument();
    expect(screen.getByText("$500+")).toBeInTheDocument();
    expect(screen.getByText("Premier Title Partnership")).toBeInTheDocument();
    expect(screen.getByText("Major Engineering Partner")).toBeInTheDocument();

    const selectTitaniumButton = screen.getByRole("button", { name: "Select Titanium" });
    fireEvent.click(selectTitaniumButton);

    const levelSelect = screen.getByLabelText("Sponsorship Level") as HTMLSelectElement;
    expect(levelSelect.value).toBe("Titanium Tier Sponsor");
  });

  it("renders published partner cards grouped by tier", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      sponsors: [
        {
          name: "NASA WV Space Grant",
          tier: "Titanium",
          websiteUrl: "https://wvspacegrant.org",
        },
        {
          name: "Local Machining Corp",
          tier: "In-Kind",
        },
      ],
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderPage();

    expect(await screen.findByText("NASA WV Space Grant")).toBeInTheDocument();
    expect(screen.getByText("Local Machining Corp")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Titanium Partners" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "In-Kind Partners" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /visit nasa wv space grant website/i })).toHaveAttribute("href", "https://wvspacegrant.org/");
  });

  it("successfully submits the sponsor interest form", async () => {
    const fetchMock = vi.fn().mockImplementation((input: unknown) => {
      const url = typeof input === "string" ? input : String((input as { url?: string })?.url || input);
      if (url.includes("/api/inquiries")) {
        return Promise.resolve(response({ success: true }));
      }
      return Promise.resolve(response({ sponsors: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();

    expect(await screen.findByText("No partners are published yet")).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText("Your organization");
    const emailInput = screen.getByPlaceholderText("you@example.org");
    const messageInput = screen.getByPlaceholderText(/We'd love to partner/i);

    fireEvent.change(nameInput, { target: { value: "Apex Dynamics" } });
    fireEvent.change(emailInput, { target: { value: "sponsor@apexdynamics.org" } });
    fireEvent.change(messageInput, { target: { value: "We would like to sponsor robot fabrication." } });

    await waitFor(() => expect(nameInput).toHaveValue("Apex Dynamics"));
    await waitFor(() => expect(emailInput).toHaveValue("sponsor@apexdynamics.org"));

    const submitButton = screen.getByRole("button", { name: "Submit Interest Request" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/inquiries", expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Apex Dynamics"),
      }));
    });

    expect(await screen.findByText(/Request sent successfully/i)).toBeInTheDocument();
  });
});
