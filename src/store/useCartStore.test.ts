/**
 * Unit tests for useCartStore Zustand hook
 * Comprehensive coverage of all store functionality including:
 * - State initialization and persistence
 * - Adding items (including quantity updates)
 * - Removing items
 * - Updating quantities
 * - Clearing the cart
 * - Cart open state management
 * - Computed values (total, count)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useCartStore } from "./useCartStore";
import type { Product } from "@shared/routes/store";

// Mock localStorage for Zustand persistence
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
});

describe("useCartStore", () => {
  // Reset store state before each test
  beforeEach(() => {
    useCartStore.setState({
      items: [],
      isOpen: false,
    });
    localStorage.clear();
  });

  // Cleanup after each test
  afterEach(() => {
    useCartStore.setState({
      items: [],
      isOpen: false,
    });
  });

  const mockProduct1: Product = {
    id: "prod-1",
    name: "ARES Team Jersey",
    description: "Official team jersey",
    priceCents: 3500,
    imageUrl: "https://example.com/jersey.jpg",
    active: 1,
    stockCount: 50,
    createdAt: "2024-01-01",
  };

  const mockProduct2: Product = {
    id: "prod-2",
    name: "ARES Team Pin",
    description: "Official team lapel pin",
    priceCents: 500,
    imageUrl: "https://example.com/pin.jpg",
    active: 1,
    stockCount: 100,
    createdAt: "2024-01-02",
  };

  const mockProduct3: Product = {
    id: "prod-3",
    name: "ARES Team Sticker",
    description: "Official team sticker pack",
    priceCents: 200,
    imageUrl: null,
    active: 1,
    stockCount: 200,
    createdAt: "2024-01-03",
  };

  describe("initial state", () => {
    it("should initialize with empty items array", () => {
      const { items } = useCartStore.getState();
      expect(items).toEqual([]);
    });

    it("should initialize with cart closed", () => {
      const { isOpen } = useCartStore.getState();
      expect(isOpen).toBe(false);
    });

    it("should return zero for empty cart total", () => {
      const { getCartTotal } = useCartStore.getState();
      expect(getCartTotal()).toBe(0);
    });

    it("should return zero for empty cart count", () => {
      const { getCartCount } = useCartStore.getState();
      expect(getCartCount()).toBe(0);
    });
  });

  describe("addItem", () => {
    it("should add a single item to an empty cart", () => {
      const { addItem } = useCartStore.getState();

      addItem(mockProduct1);

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({
        product: mockProduct1,
        quantity: 1,
      });
    });

    it("should open cart when adding an item", () => {
      const { addItem } = useCartStore.getState();

      addItem(mockProduct1);

      const { isOpen } = useCartStore.getState();
      expect(isOpen).toBe(true);
    });

    it("should add multiple different items to cart", () => {
      const { addItem } = useCartStore.getState();

      addItem(mockProduct1);
      addItem(mockProduct2);

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(2);
      expect(items[0].product.id).toBe("prod-1");
      expect(items[1].product.id).toBe("prod-2");
    });

    it("should increment quantity when adding existing item", () => {
      const { addItem } = useCartStore.getState();

      addItem(mockProduct1, 1);
      addItem(mockProduct1, 2);

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(3);
    });

    it("should use default quantity of 1 when not specified", () => {
      const { addItem } = useCartStore.getState();

      addItem(mockProduct1);

      const { items } = useCartStore.getState();
      expect(items[0].quantity).toBe(1);
    });

    it("should add item with custom quantity", () => {
      const { addItem } = useCartStore.getState();

      addItem(mockProduct1, 5);

      const { items } = useCartStore.getState();
      expect(items[0].quantity).toBe(5);
    });

    it("should calculate correct total after adding items", () => {
      const { addItem, getCartTotal } = useCartStore.getState();

      addItem(mockProduct1, 2); // 2 * $35.00 = $70.00
      addItem(mockProduct2, 3); // 3 * $5.00 = $15.00

      expect(getCartTotal()).toBe(8500); // $85.00 in cents
    });

    it("should calculate correct count after adding items", () => {
      const { addItem, getCartCount } = useCartStore.getState();

      addItem(mockProduct1, 2);
      addItem(mockProduct2, 3);

      expect(getCartCount()).toBe(5);
    });
  });

  describe("removeItem", () => {
    it("should remove item from cart", () => {
      const { addItem, removeItem } = useCartStore.getState();

      addItem(mockProduct1);
      addItem(mockProduct2);

      removeItem("prod-1");

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(1);
      expect(items[0].product.id).toBe("prod-2");
    });

    it("should not affect other items when removing one", () => {
      const { addItem, removeItem, getCartTotal } = useCartStore.getState();

      addItem(mockProduct1, 2);
      addItem(mockProduct2, 3);

      removeItem("prod-1");

      expect(getCartTotal()).toBe(1500); // Only prod-2: 3 * $5.00
    });

    it("should handle removing non-existent item gracefully", () => {
      const { addItem, removeItem } = useCartStore.getState();

      addItem(mockProduct1);

      // Should not throw
      expect(() => removeItem("non-existent")).not.toThrow();

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(1);
    });

    it("should handle removing from empty cart gracefully", () => {
      const { removeItem } = useCartStore.getState();

      // Should not throw
      expect(() => removeItem("prod-1")).not.toThrow();

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(0);
    });
  });

  describe("updateQuantity", () => {
    it("should update quantity of existing item", () => {
      const { addItem, updateQuantity } = useCartStore.getState();

      addItem(mockProduct1, 1);
      updateQuantity("prod-1", 5);

      const { items } = useCartStore.getState();
      expect(items[0].quantity).toBe(5);
    });

    it("should update cart total when quantity changes", () => {
      const { addItem, updateQuantity, getCartTotal } = useCartStore.getState();

      addItem(mockProduct1, 1); // $35.00
      expect(getCartTotal()).toBe(3500);

      updateQuantity("prod-1", 3); // 3 * $35.00 = $105.00
      expect(getCartTotal()).toBe(10500);
    });

    it("should remove item when quantity is set to zero", () => {
      const { addItem, updateQuantity } = useCartStore.getState();

      addItem(mockProduct1, 5);
      updateQuantity("prod-1", 0);

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(0);
    });

    it("should remove item when quantity is set to negative", () => {
      const { addItem, updateQuantity } = useCartStore.getState();

      addItem(mockProduct1, 5);
      updateQuantity("prod-1", -1);

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(0);
    });

    it("should handle updating non-existent item gracefully", () => {
      const { updateQuantity } = useCartStore.getState();

      // Should not throw
      expect(() => updateQuantity("non-existent", 5)).not.toThrow();

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(0);
    });
  });

  describe("clearCart", () => {
    it("should remove all items from cart", () => {
      const { addItem, clearCart } = useCartStore.getState();

      addItem(mockProduct1);
      addItem(mockProduct2);
      addItem(mockProduct3);

      clearCart();

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(0);
    });

    it("should reset cart total to zero", () => {
      const { addItem, clearCart, getCartTotal } = useCartStore.getState();

      addItem(mockProduct1);
      addItem(mockProduct2);

      clearCart();

      expect(getCartTotal()).toBe(0);
    });

    it("should reset cart count to zero", () => {
      const { addItem, clearCart, getCartCount } = useCartStore.getState();

      addItem(mockProduct1, 5);
      addItem(mockProduct2, 3);

      clearCart();

      expect(getCartCount()).toBe(0);
    });

    it("should not affect isOpen state", () => {
      const { addItem, setIsOpen, clearCart } = useCartStore.getState();

      addItem(mockProduct1);
      setIsOpen(true);

      clearCart();

      const { isOpen } = useCartStore.getState();
      expect(isOpen).toBe(true);
    });

    it("should handle clearing empty cart gracefully", () => {
      const { clearCart } = useCartStore.getState();

      // Should not throw
      expect(() => clearCart()).not.toThrow();

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(0);
    });
  });

  describe("setIsOpen", () => {
    it("should open the cart", () => {
      const { setIsOpen } = useCartStore.getState();

      setIsOpen(true);

      const { isOpen } = useCartStore.getState();
      expect(isOpen).toBe(true);
    });

    it("should close the cart", () => {
      const { setIsOpen } = useCartStore.getState();

      setIsOpen(true);
      setIsOpen(false);

      const { isOpen } = useCartStore.getState();
      expect(isOpen).toBe(false);
    });

    it("should not affect cart items when toggling", () => {
      const { addItem, setIsOpen } = useCartStore.getState();

      addItem(mockProduct1);

      setIsOpen(true);
      setIsOpen(false);

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(1);
    });
  });

  describe("getCartTotal", () => {
    it("should calculate total for single item", () => {
      const { addItem, getCartTotal } = useCartStore.getState();

      addItem(mockProduct1, 2); // 2 * $35.00 = $70.00

      expect(getCartTotal()).toBe(7000);
    });

    it("should calculate total for multiple items", () => {
      const { addItem, getCartTotal } = useCartStore.getState();

      addItem(mockProduct1, 1); // $35.00
      addItem(mockProduct2, 2); // 2 * $5.00 = $10.00
      addItem(mockProduct3, 3); // 3 * $2.00 = $6.00

      expect(getCartTotal()).toBe(5100); // $51.00
    });

    it("should return zero for empty cart", () => {
      const { getCartTotal } = useCartStore.getState();

      expect(getCartTotal()).toBe(0);
    });

    it("should handle zero price items", () => {
      const { addItem, getCartTotal } = useCartStore.getState();

      const freeProduct: Product = {
        ...mockProduct1,
        priceCents: 0,
      };

      addItem(freeProduct, 5);

      expect(getCartTotal()).toBe(0);
    });
  });

  describe("getCartCount", () => {
    it("should count items with quantity", () => {
      const { addItem, getCartCount } = useCartStore.getState();

      addItem(mockProduct1, 2);
      addItem(mockProduct2, 3);

      expect(getCartCount()).toBe(5);
    });

    it("should return zero for empty cart", () => {
      const { getCartCount } = useCartStore.getState();

      expect(getCartCount()).toBe(0);
    });

    it("should update count when quantity changes", () => {
      const { addItem, updateQuantity, getCartCount } = useCartStore.getState();

      addItem(mockProduct1, 2);
      expect(getCartCount()).toBe(2);

      updateQuantity("prod-1", 5);
      expect(getCartCount()).toBe(5);
    });

    it("should decrease count when item is removed", () => {
      const { addItem, removeItem, getCartCount } = useCartStore.getState();

      addItem(mockProduct1, 3);
      addItem(mockProduct2, 2);
      expect(getCartCount()).toBe(5);

      removeItem("prod-1");
      expect(getCartCount()).toBe(2);
    });
  });

  describe("complex workflows", () => {
    it("should handle typical shopping flow", () => {
      const { addItem, updateQuantity, removeItem, getCartTotal, getCartCount, clearCart } = useCartStore.getState();

      // Add items
      addItem(mockProduct1, 1);
      addItem(mockProduct2, 2);
      expect(getCartCount()).toBe(3);
      expect(getCartTotal()).toBe(4500); // $35.00 + 2 * $5.00

      // Update quantity
      updateQuantity("prod-1", 2);
      expect(getCartCount()).toBe(4);
      expect(getCartTotal()).toBe(8000); // 2 * $35.00 + 2 * $5.00

      // Remove item
      removeItem("prod-2");
      expect(getCartCount()).toBe(2);
      expect(getCartTotal()).toBe(7000); // 2 * $35.00

      // Clear cart
      clearCart();
      expect(getCartCount()).toBe(0);
      expect(getCartTotal()).toBe(0);
    });

    it("should handle adding same item multiple times", () => {
      const { addItem, getCartCount } = useCartStore.getState();

      addItem(mockProduct1, 1);
      addItem(mockProduct1, 2);
      addItem(mockProduct1, 3);

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(6);
      expect(getCartCount()).toBe(6);
    });

    it("should preserve items across cart open/close cycles", () => {
      const { addItem, setIsOpen, getCartCount } = useCartStore.getState();

      addItem(mockProduct1, 5);

      setIsOpen(false);
      expect(getCartCount()).toBe(5);

      setIsOpen(true);
      expect(getCartCount()).toBe(5);

      setIsOpen(false);
      expect(getCartCount()).toBe(5);
    });
  });

  describe("products with nullable fields", () => {
    it("should handle product with null image_url", () => {
      const { addItem } = useCartStore.getState();

      addItem(mockProduct3); // imageUrl is null

      const { items } = useCartStore.getState();
      expect(items[0].product.imageUrl).toBeNull();
    });

    it("should handle product with null description", () => {
      const { addItem } = useCartStore.getState();

      const productWithNullDesc: Product = {
        ...mockProduct1,
        description: null,
      };

      addItem(productWithNullDesc);

      const { items } = useCartStore.getState();
      expect(items[0].product.description).toBeNull();
    });
  });
});

