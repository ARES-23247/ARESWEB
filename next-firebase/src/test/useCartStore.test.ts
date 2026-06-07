import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore, Product } from "../store/useCartStore";

describe("useCartStore", () => {
  const mockProduct: Product = {
    id: "prod_1",
    name: "ARES T-Shirt",
    priceCents: 1500,
    active: 1,
    stockCount: 10,
  };

  const mockProduct2: Product = {
    id: "prod_2",
    name: "ARES Cap",
    priceCents: 1000,
    active: 1,
    stockCount: 5,
  };

  beforeEach(() => {
    useCartStore.getState().clearCart();
    useCartStore.getState().setIsOpen(false);
  });

  it("should initialize with an empty cart", () => {
    const state = useCartStore.getState();
    expect(state.items).toEqual([]);
    expect(state.isOpen).toBe(false);
    expect(state.getCartCount()).toBe(0);
    expect(state.getCartTotal()).toBe(0);
  });

  it("should add an item to the cart", () => {
    useCartStore.getState().addItem(mockProduct, 2);
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toEqual({ product: mockProduct, quantity: 2 });
    expect(state.isOpen).toBe(true);
    expect(state.getCartCount()).toBe(2);
    expect(state.getCartTotal()).toBe(3000);
  });

  it("should increment quantity when adding an existing product", () => {
    useCartStore.getState().addItem(mockProduct, 2);
    useCartStore.getState().addItem(mockProduct, 3);
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].quantity).toBe(5);
    expect(state.getCartCount()).toBe(5);
    expect(state.getCartTotal()).toBe(7500);
  });

  it("should remove an item from the cart", () => {
    useCartStore.getState().addItem(mockProduct, 2);
    useCartStore.getState().addItem(mockProduct2, 1);
    useCartStore.getState().removeItem("prod_1");
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].product.id).toBe("prod_2");
    expect(state.getCartCount()).toBe(1);
  });

  it("should update quantity of an item", () => {
    useCartStore.getState().addItem(mockProduct, 2);
    useCartStore.getState().updateQuantity("prod_1", 5);
    const state = useCartStore.getState();
    expect(state.items[0].quantity).toBe(5);

    // Should remove if quantity set to 0 or negative
    useCartStore.getState().updateQuantity("prod_1", 0);
    expect(useCartStore.getState().items).toHaveLength(0);
  });
});
