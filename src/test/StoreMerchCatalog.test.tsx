import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StorePage from "../app/store/page";
import {
  OFFICIAL_MERCH_CATALOG,
  SIZE_GUIDE_CHART,
  formatPrice,
  convertInchesToCm,
  convertCmToInches,
  getProductById,
  filterCatalog,
  calculateCartSubtotal,
  calculateTotalItemCount,
  createCartItemKey,
  buildPreOrderPayload,
  validatePreOrderForm,
} from "@/lib/storeCatalogData";
import { getAppCheckHeader } from "@/lib/firebaseAppCheck";
import { getRecaptchaToken } from "@/lib/recaptcha";

vi.mock("@/components/SEO", () => ({ default: () => null }));

vi.mock("@/lib/recaptcha", () => ({
  getRecaptchaToken: vi.fn(),
}));

vi.mock("@/lib/firebaseAppCheck", () => ({
  getAppCheckHeader: vi.fn(),
}));

function response(body: unknown, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function renderStorePage() {
  return render(
    <MemoryRouter>
      <StorePage />
    </MemoryRouter>
  );
}

describe("Store & Merchandise Catalog Subsystem", () => {
  beforeEach(() => {
    vi.mocked(getRecaptchaToken).mockResolvedValue("mock-recaptcha-token");
    vi.mocked(getAppCheckHeader).mockImplementation((forceRefresh?: boolean) =>
      Promise.resolve({ "X-Firebase-AppCheck": forceRefresh ? "mock-refreshed-app-check" : "mock-app-check" })
    );
  });

  describe("Catalog Data Models & Helpers", () => {
    it("contains all 5 canonical merchandise items", () => {
      expect(OFFICIAL_MERCH_CATALOG).toHaveLength(5);
      const productIds = OFFICIAL_MERCH_CATALOG.map((p) => p.id);
      expect(productIds).toEqual([
        "ares-comp-jersey",
        "ares-foil-hoodie",
        "ares-pit-cap",
        "ares-vinyl-stickers",
        "ares-3d-keychain",
      ]);

      const jersey = getProductById("ares-comp-jersey");
      expect(jersey).toBeDefined();
      expect(jersey?.name).toBe("Official Competition Jersey");
      expect(jersey?.priceCents).toBe(5500);
      expect(jersey?.sizes).toContain("XL");

      const hoodie = getProductById("ares-foil-hoodie");
      expect(hoodie?.name).toBe("Gold Foil Embroidered Hoodie");
      expect(hoodie?.priceCents).toBe(6500);

      const cap = getProductById("ares-pit-cap");
      expect(cap?.name).toBe("Team Pit Cap");
      expect(cap?.priceCents).toBe(2800);

      const stickers = getProductById("ares-vinyl-stickers");
      expect(stickers?.name).toBe("Vinyl Sticker Pack");
      expect(stickers?.priceCents).toBe(1200);

      const keychain = getProductById("ares-3d-keychain");
      expect(keychain?.name).toBe("3D Printed Robot Keychain");
      expect(keychain?.priceCents).toBe(1000);

      expect(SIZE_GUIDE_CHART).toHaveLength(7);
      expect(SIZE_GUIDE_CHART[0].size).toBe("XS");
    });

    it("formats currency correctly", () => {
      expect(formatPrice(5500)).toBe("$55.00");
      expect(formatPrice(1200)).toBe("$12.00");
      expect(formatPrice(0)).toBe("$0.00");
    });

    it("converts measurements accurately between inches and centimeters", () => {
      expect(convertInchesToCm(10)).toBe(25.4);
      expect(convertCmToInches(25.4)).toBe(10);
    });

    it("filters catalog by category and search queries", () => {
      const apparelOnly = filterCatalog(OFFICIAL_MERCH_CATALOG, "apparel");
      expect(apparelOnly).toHaveLength(2);
      expect(apparelOnly.map((p) => p.id)).toEqual(["ares-comp-jersey", "ares-foil-hoodie"]);

      const capSearch = filterCatalog(OFFICIAL_MERCH_CATALOG, "all", "cap");
      expect(capSearch).toHaveLength(1);
      expect(capSearch[0].id).toBe("ares-pit-cap");

      const emptyResults = filterCatalog(OFFICIAL_MERCH_CATALOG, "all", "nonexistent item query");
      expect(emptyResults).toHaveLength(0);
    });

    it("calculates cart subtotals and item counts accurately", () => {
      const cart = [
        { key: createCartItemKey("ares-comp-jersey", "L"), productId: "ares-comp-jersey", size: "L" as const, quantity: 2 },
        { key: createCartItemKey("ares-vinyl-stickers", "One Size"), productId: "ares-vinyl-stickers", size: "One Size" as const, quantity: 3 },
      ];

      expect(calculateCartSubtotal(cart)).toBe(5500 * 2 + 1200 * 3);
      expect(calculateTotalItemCount(cart)).toBe(5);
    });

    it("validates booster pre-order form requirements and builds payload", () => {
      const emptyValidation = validatePreOrderForm({
        name: "",
        email: "invalid-email",
        pickupLocation: "",
        items: [],
      });
      expect(emptyValidation.isValid).toBe(false);
      expect(emptyValidation.errors.name).toBeDefined();
      expect(emptyValidation.errors.email).toBeDefined();
      expect(emptyValidation.errors.pickupLocation).toBeDefined();
      expect(emptyValidation.errors.items).toBeDefined();

      const validValidation = validatePreOrderForm({
        name: "Morgan Smith",
        email: "morgan@example.org",
        pickupLocation: "tournament",
        items: [{ key: "k1", productId: "ares-comp-jersey", size: "L", quantity: 1 }],
      });
      expect(validValidation.isValid).toBe(true);
      expect(validValidation.errors).toEqual({});

      const payload = buildPreOrderPayload(
        {
          name: "Morgan Smith",
          email: "morgan@example.org",
          pickupLocation: "tournament",
          notes: "Pit pickup at state finals",
        },
        [{ key: "k1", productId: "ares-comp-jersey", size: "L", quantity: 1 }]
      );
      expect(payload.inquiryType).toBe("merch_booster_preorder");
      expect(payload.name).toBe("Morgan Smith");
      expect(payload.email).toBe("morgan@example.org");
      expect(payload.items).toHaveLength(1);
      expect(payload.items[0].productName).toBe("Official Competition Jersey");
      expect(payload.totalCents).toBe(5500);
    });
  });

  describe("Interactive UI & Store Experience", () => {
    it("renders catalog items with prices, badges, and details", () => {
      renderStorePage();

      expect(screen.getByText("Official Competition Jersey")).toBeInTheDocument();
      expect(screen.getByText("Gold Foil Embroidered Hoodie")).toBeInTheDocument();
      expect(screen.getByText("Team Pit Cap")).toBeInTheDocument();
      expect(screen.getByText("Vinyl Sticker Pack")).toBeInTheDocument();
      expect(screen.getByText("3D Printed Robot Keychain")).toBeInTheDocument();

      expect(screen.getByText("Competition Grade")).toBeInTheDocument();
      expect(screen.getByText("Winter Classic")).toBeInTheDocument();
      expect(screen.getByText("Pit Crew Gear")).toBeInTheDocument();
      expect(screen.getByText("Fan Favorite")).toBeInTheDocument();
      expect(screen.getByText("Lab Crafted")).toBeInTheDocument();
    });

    it("filters merchandise by category buttons", async () => {
      renderStorePage();

      const headwearBtn = screen.getByRole("button", { name: "Headwear" });
      fireEvent.click(headwearBtn);

      expect(screen.getByText("Team Pit Cap")).toBeInTheDocument();
      expect(screen.queryByText("Official Competition Jersey")).not.toBeInTheDocument();
      expect(screen.queryByText("Gold Foil Embroidered Hoodie")).not.toBeInTheDocument();

      const allBtn = screen.getByRole("button", { name: "All Merchandise" });
      fireEvent.click(allBtn);

      expect(screen.getByText("Official Competition Jersey")).toBeInTheDocument();
      expect(screen.getByText("Team Pit Cap")).toBeInTheDocument();
    });

    it("searches catalog with keyword and displays empty state with reset", async () => {
      renderStorePage();

      const searchInput = screen.getByLabelText("Search merchandise catalog");
      fireEvent.change(searchInput, { target: { value: "Keychain" } });

      expect(screen.getByText("3D Printed Robot Keychain")).toBeInTheDocument();
      expect(screen.queryByText("Official Competition Jersey")).not.toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: "nonexistent robot gear" } });

      expect(screen.getByText("No items match your search")).toBeInTheDocument();

      const resetBtn = screen.getByRole("button", { name: "Reset Filters" });
      fireEvent.click(resetBtn);

      expect(screen.getByText("Official Competition Jersey")).toBeInTheDocument();
    });

    it("opens and toggles unit measurements in Size Guide Modal", async () => {
      renderStorePage();

      const sizeGuideBtn = screen.getByRole("button", { name: "Size Guide" });
      fireEvent.click(sizeGuideBtn);

      expect(screen.getByText("Merchandise Size Guide")).toBeInTheDocument();
      expect(screen.getByTestId("size-guide-table")).toBeInTheDocument();

      expect(screen.getByText('34"')).toBeInTheDocument();

      const cmBtn = screen.getByRole("button", { name: "Centimeters (cm)" });
      fireEvent.click(cmBtn);

      expect(screen.getByText("86.4 cm")).toBeInTheDocument();

      const gotItBtn = screen.getByRole("button", { name: "Got It" });
      fireEvent.click(gotItBtn);

      await waitFor(() => {
        expect(screen.queryByText("Merchandise Size Guide")).not.toBeInTheDocument();
      });
    });

    it("allows size selection and quantity changes on product cards", async () => {
      renderStorePage();

      const jerseyCard = screen.getByTestId("product-card-ares-comp-jersey");
      const sizeMBtn = jerseyCard.querySelector("button:nth-of-type(3)") as HTMLButtonElement;
      if (sizeMBtn) {
        fireEvent.click(sizeMBtn);
      }

      const plusBtn = jerseyCard.querySelector('[aria-label="Increase quantity"]') as HTMLButtonElement;
      fireEvent.click(plusBtn);

      const addBtn = jerseyCard.querySelector('[aria-label*="Add"]') as HTMLButtonElement;
      fireEvent.click(addBtn);

      expect(jerseyCard).toHaveTextContent("Added!");
      expect(screen.getByTestId("header-cart-button")).toHaveTextContent("Pre-Order Cart (2)");
    });

    it("manages cart drawer items, updates quantity, and removes items", async () => {
      renderStorePage();

      const stickerCard = screen.getByTestId("product-card-ares-vinyl-stickers");
      const addStickerBtn = stickerCard.querySelector('[aria-label*="Add"]') as HTMLButtonElement;
      fireEvent.click(addStickerBtn);

      const openCartBtn = screen.getByTestId("header-cart-button");
      fireEvent.click(openCartBtn);

      expect(screen.getByText("Pre-Order Cart")).toBeInTheDocument();
      expect(screen.getByTestId("cart-items-list")).toBeInTheDocument();
      expect(screen.getByTestId("cart-drawer-subtotal")).toHaveTextContent("$12.00");

      const increaseBtn = screen.getByLabelText("Increase quantity of Vinyl Sticker Pack");
      fireEvent.click(increaseBtn);

      expect(screen.getByTestId("cart-drawer-subtotal")).toHaveTextContent("$24.00");

      const removeBtn = screen.getByLabelText(/Remove Vinyl Sticker Pack/i);
      fireEvent.click(removeBtn);

      expect(screen.getByText("Your Cart is Empty")).toBeInTheDocument();
    });

    it("submits booster pre-order inquiry successfully with App Check and resets cart", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        response({ success: true, message: "Application submitted successfully.", id: "inq_123" })
      );
      vi.stubGlobal("fetch", fetchMock);

      renderStorePage();

      const keychainCard = screen.getByTestId("product-card-ares-3d-keychain");
      const addKeychainBtn = keychainCard.querySelector('[aria-label*="Add"]') as HTMLButtonElement;
      fireEvent.click(addKeychainBtn);

      const openCartBtn = screen.getByTestId("header-cart-button");
      fireEvent.click(openCartBtn);

      const proceedBtn = screen.getByRole("button", { name: "Submit Booster Pre-Order" });
      fireEvent.click(proceedBtn);

      expect(screen.getByText("Booster Pre-Order Inquiry")).toBeInTheDocument();
      expect(screen.getByTestId("preorder-form")).toBeInTheDocument();

      const nameInput = screen.getByLabelText("Your Full Name *");
      const emailInput = screen.getByLabelText("Email Address *");
      const notesInput = screen.getByLabelText(/Booster Notes/i);

      fireEvent.change(nameInput, { target: { value: "Jordan Lee" } });
      fireEvent.change(emailInput, { target: { value: "jordan@aresbooster.org" } });
      fireEvent.change(notesInput, { target: { value: "Pick up at WV State Championship" } });

      const submitBtn = screen.getByRole("button", { name: "Send Pre-Order Inquiry" });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/inquiries",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              "X-Firebase-AppCheck": "mock-app-check",
            }),
          })
        );
      });

      expect(await screen.findByTestId("preorder-success-view")).toBeInTheDocument();
      expect(screen.getByText("Pre-Order Received!")).toBeInTheDocument();

      const returnBtn = screen.getByRole("button", { name: "Return to Store" });
      fireEvent.click(returnBtn);

      expect(screen.getByTestId("header-cart-button")).toHaveTextContent("Pre-Order Cart (0)");
    });

    it("displays error alert if pre-order inquiry submission fails", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        response({ error: "Network error occurred" }, 500, "Internal Server Error")
      );
      vi.stubGlobal("fetch", fetchMock);

      renderStorePage();

      const keychainCard = screen.getByTestId("product-card-ares-3d-keychain");
      const addKeychainBtn = keychainCard.querySelector('[aria-label*="Add"]') as HTMLButtonElement;
      fireEvent.click(addKeychainBtn);

      const openCartBtn = screen.getByTestId("header-cart-button");
      fireEvent.click(openCartBtn);

      const proceedBtn = screen.getByRole("button", { name: "Submit Booster Pre-Order" });
      fireEvent.click(proceedBtn);

      fireEvent.change(screen.getByLabelText("Your Full Name *"), { target: { value: "Taylor Brown" } });
      fireEvent.change(screen.getByLabelText("Email Address *"), { target: { value: "taylor@example.com" } });

      const submitBtn = screen.getByRole("button", { name: "Send Pre-Order Inquiry" });
      fireEvent.click(submitBtn);

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/Network error occurred/i)).toBeInTheDocument();
    });
  });

  describe("Zero Financial PII & Payment Gateway Protection", () => {
    it("guarantees zero credit card, CVV, expiration date, or banking inputs in the entire DOM", () => {
      renderStorePage();

      expect(screen.queryByLabelText(/credit card/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/card number/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/cvv/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/cvc/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/expiration/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/routing number/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/bank account/i)).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/card/i)).not.toBeInTheDocument();

      expect(
        screen.getByText(/Zero Online Payment Processing • 100% Team Booster Support/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/To protect your financial security, we collect zero payment cards/i)
      ).toBeInTheDocument();
    });
  });
});
