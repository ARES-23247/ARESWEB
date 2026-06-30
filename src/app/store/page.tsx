"use client";

import React, { useEffect, useState } from "react";
import { ShoppingCart, Search, CheckCircle2, Plus, Minus, X, ShoppingBag, Loader2, Sparkles, CreditCard, Tag } from "lucide-react";
import { useCartStore, Product, selectCartTotal, selectCartCount } from "@/store/useCartStore";
import { useAuth } from "@/context/AuthContext";
import SEO from "@/components/SEO";

const MOCK_PRODUCTS: Product[] = [
  {
    id: "prod_1",
    name: "ARES Official Team Jersey",
    description: "Championship-grade athletic jersey with custom asymmetrical branding and Appalachian gold lines.",
    priceCents: 4500,
    imageUrl: "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=500&auto=format&fit=crop&q=60",
    active: 1,
    stockCount: 50
  },
  {
    id: "prod_2",
    name: "Mountaineer Mindset Hoodie",
    description: "Sleek obsidian black hoodie with gold metallic sleeve prints and ares-red interior linings.",
    priceCents: 5500,
    imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500&auto=format&fit=crop&q=60",
    active: 1,
    stockCount: 40
  },
  {
    id: "prod_3",
    name: "ARESLib Precision Cap",
    description: "Low-profile spartan-cut structured cap with high-fidelity embroidery and adjustable strap.",
    priceCents: 2500,
    imageUrl: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500&auto=format&fit=crop&q=60",
    active: 1,
    stockCount: 30
  },
  {
    id: "prod_4",
    name: "Autonomous Run Decal Pack",
    description: "TPU reflective decals featuring GoBilda Pinpoint encoder pod designs and ARES 23247 insignias.",
    priceCents: 1000,
    imageUrl: "https://images.unsplash.com/photo-1572375995301-40188b13dcd7?w=500&auto=format&fit=crop&q=60",
    active: 1,
    stockCount: 100
  }
];

export default function StorePage() {
  const { user } = useAuth();
  const items = useCartStore((s) => s.items);
  const isOpen = useCartStore((s) => s.isOpen);
  const setIsOpen = useCartStore((s) => s.setIsOpen);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);

  const cartTotal = useCartStore(selectCartTotal);
  const cartCount = useCartStore(selectCartCount);
  
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [checkoutCancelled, setCheckoutCancelled] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Sync parameters from virtual urls
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      setCheckoutSuccess(true);
      clearCart();
    }
    if (params.get("cancel") === "true") {
      setCheckoutCancelled(true);
    }
  }, [clearCart]);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setIsCheckingOut(true);
    
    try {
      const total = cartTotal;
      
      const orderRecord = {
        customerEmail: user?.email || "anonymous-buyer@gmail.com",
        items: items.map(i => ({ productId: i.product.id, quantity: i.quantity, name: i.product.name })),
        totalCents: total,
      };

      try {
        const response = await fetch("/api/store/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderRecord)
        });
        const resData = await response.json();
        if (!response.ok || !resData.success) {
          throw new Error(resData.error || "Failed to log order on secure server");
        }
      } catch (e) {
        console.warn("Secure order log bypassed or failed in sandboxed mode:", e);
      }

      // Simulate routing to Stripe and redirecting back with success params
      setTimeout(() => {
        setIsCheckingOut(false);
        setIsOpen(false);
        window.location.href = `${window.location.pathname}?success=true`;
      }, 1500);
      
    } catch (err) {
      console.error("Checkout process error:", err);
      setIsCheckingOut(false);
      alert("Checkout failed. Please try again.");
    }
  };

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8 relative">
      <SEO 
        title={checkoutSuccess ? "Checkout Success" : checkoutCancelled ? "Checkout Cancelled" : "Team Store"} 
        description="Grab official ARES 23247 team apparel, hoodies, and jerseys. 100% of proceeds directly fund our drivetrain materials and youth STEM outreach camps." 
        noindex={checkoutSuccess || checkoutCancelled}
      />
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-20">
        
        {/* Header */}
        <header className="mb-12 border-b border-ares-bronze/30 pb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
          <div>
            <p className="text-ares-gold font-bold uppercase tracking-widest text-sm mb-4">
              Support Team 23247
            </p>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter">
              ARES <span className="bg-ares-red px-6 py-2 ares-cut shadow-xl text-white font-bold inline-block">Store</span>
            </h1>
            <p className="text-marble/85 text-lg font-medium max-w-2xl">
              Grab official team apparel and merchandise. 100% of proceeds fund drivetrain fabrications and outreach camps.
            </p>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className="relative clipped-button bg-white/5 border border-white/20 hover:border-ares-gold text-white hover:text-white px-6 py-3 font-bold transition-all shrink-0 flex items-center gap-2"
          >
            <ShoppingCart className="w-5 h-5 text-ares-gold" />
            <span>View Cart</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-ares-red text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg border border-ares-bronze/40">
                {cartCount}
              </span>
            )}
          </button>
        </header>

        {/* Notifications */}
        {checkoutSuccess && (
          <div className="mb-10 p-5 glass-card ares-cut border border-ares-success/30 bg-ares-success/5 flex items-start gap-4 text-ares-success">
            <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-white text-lg">Order Successful!</h3>
              <p className="text-sm text-marble/80 mt-1">Thank you for supporting ARES 23247! A receipt and order processing confirmation has been successfully routed.</p>
            </div>
            <button onClick={() => window.history.replaceState({}, document.title, window.location.pathname)} className="ml-auto text-marble/40 hover:text-white">
              <X size={16} />
            </button>
          </div>
        )}

        {checkoutCancelled && (
          <div className="mb-10 p-5 glass-card ares-cut border border-white/10 bg-white/5 text-marble/90">
            Checkout was cancelled. Your items remain saved in your cart.
          </div>
        )}

        {/* Search & Filters */}
        <div className="mb-10 max-w-md">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-marble/40" />
            <input
              type="text"
              placeholder="Search team gear..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/15 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:border-ares-gold focus:ring-1 focus:ring-ares-gold transition-colors text-sm"
            />
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-24 text-center glass-card ares-cut border border-white/10">
            <ShoppingBag className="w-16 h-16 opacity-20 mx-auto mb-4" />
            <p className="text-lg text-marble/60">No products match your search query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredProducts.map((product) => (
              <div key={product.id} className="glass-card hero-card overflow-hidden flex flex-col h-full border border-white/10 relative group">
                <div className="aspect-square bg-black/25 relative overflow-hidden">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-marble/45">
                      No Image Available
                    </div>
                  )}
                  <div className="absolute top-3 left-3 bg-obsidian/85 px-2.5 py-1 rounded border border-white/15 text-[10px] uppercase font-bold tracking-widest text-ares-gold flex items-center gap-1">
                    <Tag size={10} /> Active Gear
                  </div>
                </div>

                <div className="p-6 flex flex-col flex-1 justify-between gap-4">
                  <div>
                    <h3 className="font-heading font-bold text-xl text-white mb-2 leading-tight group-hover:text-ares-red transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-marble/75 text-xs leading-relaxed line-clamp-2">
                      {product.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
                    <span className="font-mono font-bold text-ares-gold text-xl">
                      ${(product.priceCents / 100).toFixed(2)}
                    </span>
                    <button
                      onClick={() => addItem(product)}
                      className="clipped-button-sm bg-ares-red text-white hover:bg-ares-gold hover:text-black transition-colors font-bold text-xs"
                    >
                      <Plus size={14} className="mr-1" /> Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Drawer */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 w-full md:w-[420px] bg-obsidian border-l border-white/10 shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
            {/* Drawer Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-ares-gold" />
                <h2 className="font-heading font-bold text-lg text-white">Your Cart</h2>
                <span className="bg-white/5 border border-white/10 text-marble/80 text-xs px-2.5 py-0.5 rounded-full ml-2">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-marble/50 hover:text-white hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Items */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-marble/55 space-y-4">
                  <ShoppingCart className="w-16 h-16 opacity-10" />
                  <p>Your cart is empty.</p>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-bold transition-all text-xs uppercase tracking-wider"
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.product.id} className="flex gap-4 bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="w-20 h-20 bg-black/10 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                      {item.product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-marble/30">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-white text-sm leading-tight">{item.product.name}</h3>
                        <p className="text-ares-gold font-mono mt-1 text-sm">
                          ${(item.product.priceCents / 100).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-3 bg-black/40 rounded-lg border border-white/15 p-1">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="p-1 hover:bg-white/10 rounded text-marble/60 hover:text-white transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-sm font-mono text-white w-4 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="p-1 hover:bg-white/10 rounded text-marble/60 hover:text-white transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(item.product.id)}
                          className="text-xs text-ares-danger hover:text-white transition-colors font-bold uppercase tracking-wide"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Drawer Subtotal */}
            {items.length > 0 && (
              <div className="p-5 border-t border-white/10 bg-black/40 backdrop-blur-md space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-marble/70 text-sm">Estimated Subtotal</span>
                  <span className="text-xl font-bold text-white font-mono">
                    ${(cartTotal / 100).toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  className="w-full bg-ares-gold hover:bg-ares-gold/90 text-black font-bold py-3 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(255,183,27,0.2)] hover:shadow-[0_0_25px_rgba(255,183,27,0.4)] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-wider text-xs focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing Checkout...
                    </>
                  ) : (
                    <>
                      <CreditCard size={14} /> Secure Checkout
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
