"use client";

import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  Heart,
  ShoppingBag,
} from "lucide-react";
import {
  type CartItem,
  type Product,
  formatPrice,
  calculateCartSubtotal,
  calculateTotalItemCount,
  getProductById,
} from "@/lib/storeCatalogData";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  catalog: readonly Product[];
  onUpdateQuantity: (key: string, newQuantity: number) => void;
  onRemoveItem: (key: string) => void;
  onClearCart: () => void;
  onProceedToCheckout: () => void;
}

export default function CartDrawer({
  isOpen,
  onClose,
  items,
  catalog,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onProceedToCheckout,
}: CartDrawerProps) {
  const subtotalCents = calculateCartSubtotal(items, catalog);
  const totalCount = calculateTotalItemCount(items);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-obsidian border-l border-ares-gold/40 text-marble shadow-2xl focus:outline-none"
          aria-describedby="cart-drawer-description"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ares-red/10 text-ares-red border border-ares-red/30">
                <ShoppingCart className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-black uppercase tracking-tight text-white font-heading">
                  Pre-Order Cart
                </Dialog.Title>
                <p id="cart-drawer-description" className="text-xs text-marble/70">
                  {totalCount} {totalCount === 1 ? "item" : "items"} selected
                </p>
              </div>
            </div>

            <Dialog.Close
              aria-label="Close cart drawer"
              className="rounded-lg p-2 text-marble/60 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center p-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-marble/40 border border-white/10 mb-4">
                  <ShoppingBag className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-black uppercase text-white font-heading">
                  Your Cart is Empty
                </h3>
                <p className="mt-2 text-xs text-marble/70 max-w-xs">
                  Support ARES Team 23247 by adding official competition jerseys, foil hoodies, or pit gear.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-6 clipped-button bg-ares-red text-white text-xs font-black uppercase px-6 py-2.5"
                >
                  Explore Catalog
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-white/10" data-testid="cart-items-list">
                {items.map((item) => {
                  const product = getProductById(item.productId, catalog);
                  if (!product) return null;
                  const lineTotal = product.priceCents * item.quantity;

                  return (
                    <li key={item.key} className="py-4 first:pt-0 last:pb-0 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h4 className="text-sm font-black text-white">{product.name}</h4>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-marble/70">
                            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-ares-gold">
                              Size: {item.size}
                            </span>
                            <span>•</span>
                            <span>{formatPrice(product.priceCents)} each</span>
                          </div>
                        </div>

                        <span className="font-mono text-sm font-black text-white">
                          {formatPrice(lineTotal)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        {/* Stepper */}
                        <div
                          className="inline-flex items-center rounded border border-white/10 bg-white/5"
                          role="group"
                          aria-label={`Quantity for ${product.name} size ${item.size}`}
                        >
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.key, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            aria-label={`Decrease quantity of ${product.name}`}
                            className="px-2 py-1 text-marble/70 hover:text-white disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-[24px] text-center font-mono text-xs font-bold text-white">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.key, item.quantity + 1)}
                            disabled={item.quantity >= 20}
                            aria-label={`Increase quantity of ${product.name}`}
                            className="px-2 py-1 text-marble/70 hover:text-white disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.key)}
                          aria-label={`Remove ${product.name} size ${item.size} from cart`}
                          className="flex items-center gap-1 text-[11px] text-marble/50 hover:text-ares-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan p-1 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer / Checkout */}
          {items.length > 0 && (
            <div className="border-t border-white/10 bg-white/[0.02] p-6 space-y-4">
              {/* Travel Fund Notice */}
              <div className="rounded-lg border border-ares-gold/20 bg-ares-gold/5 p-3 text-[11px] text-marble/80">
                <div className="flex items-center gap-1.5 font-bold text-ares-gold mb-1">
                  <Heart className="h-3.5 w-3.5 fill-ares-gold" aria-hidden="true" />
                  <span>Team Travel & Booster Fund</span>
                </div>
                <p className="leading-relaxed">
                  Proceeds directly offset student competition registration and regional travel. Zero credit cards are processed on this site.
                </p>
              </div>

              {/* Subtotal */}
              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <span className="text-sm font-bold uppercase tracking-wider text-marble">
                  Estimated Total:
                </span>
                <span className="font-mono text-xl font-black text-white" data-testid="cart-drawer-subtotal">
                  {formatPrice(subtotalCents)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onProceedToCheckout}
                  className="w-full flex items-center justify-center gap-2 rounded bg-ares-red hover:bg-ares-bronze px-6 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-xl transition-all active:scale-98 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  <span>Submit Booster Pre-Order</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={onClearCart}
                    className="text-[11px] text-marble/60 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1"
                  >
                    Clear All Items
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-[11px] text-ares-gold hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1"
                  >
                    Continue Browsing
                  </button>
                </div>
              </div>

              {/* Security Seal */}
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-marble/50">
                <ShieldCheck className="h-3.5 w-3.5 text-ares-gold" aria-hidden="true" />
                <span>Zero Financial PII • App Check Protected</span>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
