import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product } from "@shared/routes/store";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setIsOpen: (isOpen: boolean) => void;
  getCartTotal: () => number;
  getCartCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      addItem: (product: Product, quantity = 1) => {
        set((state: CartState) => {
          const existingItem = state.items.find((i: CartItem) => i.product.id === product.id);
          if (existingItem) {
            return {
              items: state.items.map((i: CartItem) =>
                i.product.id === product.id
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
              isOpen: true,
            };
          }
          return { items: [...state.items, { product, quantity }], isOpen: true };
        });
      },
      removeItem: (productId: string) => {
        set((state: CartState) => ({
          items: state.items.filter((i: CartItem) => i.product.id !== productId),
        }));
      },
      updateQuantity: (productId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set((state: CartState) => ({
          items: state.items.map((i: CartItem) =>
            i.product.id === productId ? { ...i, quantity } : i
          ),
        }));
      },
      clearCart: () => set({ items: [] } as Partial<CartState>),
      setIsOpen: (isOpen: boolean) => set({ isOpen } as Partial<CartState>),
      getCartTotal: () => {
        return get().items.reduce((total: number, item: CartItem) => total + item.product.priceCents * item.quantity, 0);
      },
      getCartCount: () => {
        return get().items.reduce((count: number, item: CartItem) => count + item.quantity, 0);
      },
    }),
    {
      name: "ares-cart-storage",
      partialize: (state) => ({ items: state.items }), // Persist only items
    }
  )
);
