import { useRef, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FinanceLedgerPage from "../app/finance/page";
import StorePage from "../app/store/page";
import { DesktopUserMenu } from "../components/navigation/DesktopUserMenu";
import { MobileNavDrawer } from "../components/navigation/MobileNavDrawer";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/SeasonPicker", () => ({
  default: ({ value, onChange, label }: { value: string | number; onChange: (value: string) => void; label: string }) => (
    <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}><option value="">All seasons</option><option value="2026">2026</option></select></label>
  ),
}));

function response(body: unknown, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function renderInRouter(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe("store support choices", () => {
  it("keeps checkout disabled and links to verified support channels", () => {
    renderInRouter(<StorePage />);

    expect(screen.getByText(/Zero Online Payment Processing • 100% Team Booster Support/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sponsor the team/i })).toHaveAttribute("href", "/sponsors#sponsor-form-section");
    expect(screen.getByRole("link", { name: /join ares/i })).toHaveAttribute("href", "/join");
    expect(screen.getByRole("link", { name: /contact the team/i })).toHaveAttribute("href", expect.stringContaining("mailto:contact@aresfirst.org"));
    expect(screen.queryByRole("button", { name: /^checkout$|^pay$/i })).not.toBeInTheDocument();
  });
});

describe("finance ledger reliability and accessibility", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("labels filters and loads the next cursor page without claiming a full total", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({
        transactions: [
          { id: "income-1", amount: 1000, type: "income", category: "Sponsor", date: "2026-08-01", description: "Published gift", seasonId: 2026 },
          { id: "expense-1", amount: 250, type: "expense", category: "Parts", date: "2026-08-02", description: "Robot wheels", seasonId: 2026 },
        ],
        hasMore: true,
        nextCursor: "cursor/one",
      }))
      .mockResolvedValueOnce(response({
        transactions: [{ id: "expense-2", amount: 75, type: "expense", category: "Travel", date: "2026-08-03" }],
        hasMore: false,
        nextCursor: null,
      }));
    vi.stubGlobal("fetch", fetchMock);

    renderInRouter(<FinanceLedgerPage />);

    expect(await screen.findByText("$1,000")).toBeInTheDocument();
    expect(screen.getByLabelText("Search transactions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "all" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/showing 2 loaded records/i)).toBeInTheDocument();
    expect(screen.getByText(/summary cards use loaded records only/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /load more records/i }));
    expect(await screen.findAllByText("Travel")).toHaveLength(2);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/finance?limit=50&cursor=cursor%2Fone");

    fireEvent.click(screen.getByRole("button", { name: "expense" }));
    expect(screen.getByRole("button", { name: "expense" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/showing 2 matching records from 3 loaded/i)).toBeInTheDocument();

    const exportCsvLink = screen.getByRole("link", {
      name: "Download financial ledger records as CSV",
    });
    expect(exportCsvLink).toBeInTheDocument();
    expect(exportCsvLink).toHaveAttribute("download", "ares-23247-finance-ledger.csv");
    expect(exportCsvLink).toHaveAttribute(
      "href",
      expect.stringMatching(/^data:text\/csv;charset=utf-8,%EF%BB%BF/)
    );
  });

  it("keeps loaded records visible and explains a 403 refresh failure", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({
        transactions: [{ id: "income-1", amount: 400, type: "income", category: "Fundraiser", date: "2026-08-01" }],
        hasMore: false,
        nextCursor: null,
      }))
      .mockResolvedValueOnce(response({}, 403, "Forbidden"));
    vi.stubGlobal("fetch", fetchMock);

    renderInRouter(<FinanceLedgerPage />);
    expect(await screen.findByText("Fundraiser")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh ledger" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("HTTP 403: Forbidden");
    expect(alert).toHaveTextContent("Ask a team lead to check your access");
    expect(screen.getByText("Fundraiser")).toBeInTheDocument();
  });
});

describe("account navigation keyboard behavior", () => {
  it("opens the desktop portal by click or keyboard and returns focus on Escape", async () => {
    renderInRouter(
      <DesktopUserMenu
        loading={false}
        isSignedIn
        user={{ uid: "member-1", displayName: "Member", email: "member@example.org" }}
        userRole="mentor"
        userImage={null}
        hasPendingInquiries={false}
        logout={vi.fn()}
        loginWithGoogle={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Portal" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "Portal account" })).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole("menu", { name: "Portal account" })).not.toBeInTheDocument();

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const commandCenter = screen.getByRole("menuitem", { name: "Command Center" });
    await waitFor(() => expect(commandCenter).toHaveFocus());
    fireEvent.keyDown(screen.getByRole("menu", { name: "Portal account" }), { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "My Profile" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Portal account" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("portals the mobile dialog, locks the page, and restores trigger focus", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      const triggerRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>Open test menu</button>
          <MobileNavDrawer
            isOpen={open}
            onClose={() => setOpen(false)}
            loading={false}
            isSignedIn={false}
            user={null}
            userRole="Pending Verification"
            userImage={null}
            hasPendingInquiries={false}
            logout={vi.fn()}
            loginWithGoogle={vi.fn()}
            returnFocusRef={triggerRef}
          />
        </>
      );
    }

    const { container } = renderInRouter(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open test menu" });
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "Mobile navigation menu" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    expect(container).toHaveAttribute("aria-hidden", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Mobile navigation menu" })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(document.body.style.overflow).toBe("");
    expect(container).not.toHaveAttribute("aria-hidden");
  });
});
