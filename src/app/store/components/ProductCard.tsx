"use client";

import React, { useState } from "react";
import {
  Shirt,
  Sparkles,
  Tag,
  Ruler,
  Plus,
  Minus,
  Check,
  ShoppingCart,
  Bot,
  Crown,
} from "lucide-react";
import {
  type Product,
  type ProductSize,
  formatPrice,
} from "@/lib/storeCatalogData";

interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: string, size: ProductSize, quantity: number) => void;
  onOpenSizeGuide: () => void;
}

export default function ProductCard({
  product,
  onAddToCart,
  onOpenSizeGuide,
}: ProductCardProps) {
  const [selectedSize, setSelectedSize] = useState<ProductSize>(product.defaultSize);
  const [quantity, setQuantity] = useState<number>(1);
  const [justAdded, setJustAdded] = useState<boolean>(false);

  const hasMultipleSizes = product.sizes.length > 1;

  const handleAdd = () => {
    onAddToCart(product.id, selectedSize, quantity);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  const handleIncrement = () => {
    setQuantity((prev) => Math.min(prev + 1, 20));
  };

  const handleDecrement = () => {
    setQuantity((prev) => Math.max(prev - 1, 1));
  };

  const renderProductIcon = () => {
    switch (product.id) {
      case "ares-comp-jersey":
        return <Shirt className="h-16 w-16 text-ares-red transition-transform duration-500 group-hover:scale-110" />;
      case "ares-foil-hoodie":
        return <Sparkles className="h-16 w-16 text-ares-gold transition-transform duration-500 group-hover:scale-110" />;
      case "ares-pit-cap":
        return <Crown className="h-16 w-16 text-ares-cyan transition-transform duration-500 group-hover:scale-110" />;
      case "ares-vinyl-stickers":
        return <Tag className="h-16 w-16 text-ares-gold transition-transform duration-500 group-hover:scale-110" />;
      case "ares-3d-keychain":
      default:
        return <Bot className="h-16 w-16 text-ares-bronze transition-transform duration-500 group-hover:scale-110" />;
    }
  };

  return (
    <article
      data-testid={`product-card-${product.id}`}
      className="group flex flex-col justify-between ares-cut-lg border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-ares-gold/40 hover:bg-white/[0.05] hover:shadow-2xl"
    >
      <div>
        {/* Visual Header */}
        <div className="relative mb-6 flex h-48 w-full items-center justify-center rounded-lg border border-white/5 bg-gradient-to-b from-white/[0.05] to-transparent overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-ares-red via-ares-gold to-ares-cyan opacity-80" />

          {/* Badge */}
          {product.badge && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded bg-ares-red/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
              {product.badge}
            </span>
          )}

          <div className="flex flex-col items-center justify-center p-4 text-center">
            {renderProductIcon()}
          </div>
        </div>

        {/* Info */}
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-ares-gold">
              {product.category}
            </span>
            <span className="font-mono text-lg font-black text-white">
              {formatPrice(product.priceCents)}
            </span>
          </div>

          <h3 className="mt-1 text-xl font-black tracking-tight text-white font-heading">
            {product.name}
          </h3>

          <p className="mt-2 text-xs leading-relaxed text-marble/80 line-clamp-3">
            {product.description}
          </p>
        </div>

        {/* Feature bullets */}
        <ul className="mb-6 space-y-1.5 border-t border-white/5 pt-4 text-[11px] text-marble/70">
          {product.details.map((detail, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ares-gold" aria-hidden="true" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Product Interactive Controls */}
      <div className="space-y-4 border-t border-white/10 pt-4">
        {/* Size Selection (if applicable) */}
        {hasMultipleSizes ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor={`size-select-${product.id}`}
                className="text-[11px] font-black uppercase tracking-wider text-marble"
              >
                Select Size
              </label>
              <button
                type="button"
                onClick={onOpenSizeGuide}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-ares-gold hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1"
                aria-label={`View size guide for ${product.name}`}
              >
                <Ruler className="h-3 w-3" aria-hidden="true" />
                <span>Size Guide</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Size options for ${product.name}`}>
              {product.sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  role="radio"
                  aria-checked={selectedSize === size}
                  onClick={() => setSelectedSize(size)}
                  className={`min-w-[36px] rounded px-2.5 py-1 text-xs font-bold transition-all ${
                    selectedSize === size
                      ? "bg-ares-gold text-obsidian font-black shadow-md ring-1 ring-white"
                      : "bg-white/5 text-marble/80 hover:bg-white/10 hover:text-white border border-white/10"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-marble/60 italic">
            Standard Fit / Single Specification
          </div>
        )}

        {/* Quantity Stepper & Add Button */}
        <div className="flex items-center gap-3">
          <div
            className="inline-flex items-center rounded border border-white/10 bg-white/5"
            role="group"
            aria-label={`Quantity for ${product.name}`}
          >
            <button
              type="button"
              onClick={handleDecrement}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
              className="px-2.5 py-2 text-marble/70 hover:text-white disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[28px] text-center font-mono text-xs font-bold text-white" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              onClick={handleIncrement}
              disabled={quantity >= 20}
              aria-label="Increase quantity"
              className="px-2.5 py-2 text-marble/70 hover:text-white disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            aria-label={`Add ${quantity} ${product.name} to pre-order cart`}
            className={`flex-1 flex items-center justify-center gap-2 rounded px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
              justAdded
                ? "bg-ares-gold text-obsidian font-extrabold shadow-lg"
                : "bg-ares-red hover:bg-ares-bronze text-white shadow-md active:scale-98"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan`}
          >
            {justAdded ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                <span>Added!</span>
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                <span>Add to Pre-Order</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
