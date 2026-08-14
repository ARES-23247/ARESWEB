"use client";

import React, { useState, useMemo } from "react";
import {
  ShoppingCart,
  Ruler,
  Search,
  Heart,
  HandHeart,
  Users,
  Mail,
  ArrowRight,
  Package,
  Lock,
} from "lucide-react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { siteConfig } from "@/lib/site-config";
import {
  OFFICIAL_MERCH_CATALOG,
  CATEGORY_LABELS,
  type ProductCategory,
  type ProductSize,
  type CartItem,
  filterCatalog,
  calculateTotalItemCount,
  createCartItemKey,
} from "@/lib/storeCatalogData";
import ProductCard from "./components/ProductCard";
import SizeGuideModal from "./components/SizeGuideModal";
import CartDrawer from "./components/CartDrawer";
import PreOrderModal from "./components/PreOrderModal";

export default function StorePage() {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [isPreOrderOpen, setIsPreOrderOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    return filterCatalog(OFFICIAL_MERCH_CATALOG, selectedCategory, searchQuery);
  }, [selectedCategory, searchQuery]);

  const totalCartCount = useMemo(() => calculateTotalItemCount(cartItems), [cartItems]);

  const handleAddToCart = (productId: string, size: ProductSize, quantity: number) => {
    const key = createCartItemKey(productId, size);
    setCartItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.key === key);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      }
      return [...prev, { key, productId, size, quantity }];
    });
  };

  const handleUpdateQuantity = (key: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveItem(key);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, quantity: newQuantity } : item))
    );
  };

  const handleRemoveItem = (key: string) => {
    setCartItems((prev) => prev.filter((item) => item.key !== key));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const handleProceedToPreOrder = () => {
    setIsCartOpen(false);
    setIsPreOrderOpen(true);
  };

  const handleOrderSuccess = () => {
    setCartItems([]);
  };

  const categories: ProductCategory[] = [
    "all",
    "apparel",
    "headwear",
    "accessories",
    "collectibles",
  ];

  return (
    <div className="min-h-screen w-full bg-obsidian py-8 text-marble">
      <SEO
        title="Team Store & Season Booster Portal"
        description="Official ARES 23247 merchandise catalog, size guides, and booster pre-orders supporting student robotics competition travel."
      />

      <div className="mx-auto w-full max-w-6xl px-6 py-8 md:py-16">
        {/* Header */}
        <header className="mb-12 border-b border-ares-bronze/30 pb-8 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 ares-cut-sm bg-white/5 border border-white/10 text-ares-gold text-xs font-black uppercase tracking-widest mb-4">
            <Heart aria-hidden="true" size={14} className="fill-ares-gold text-ares-gold" />
            Support Team 23247
          </div>
          <h1 className="mb-4 text-4xl font-black tracking-tighter text-white md:text-6xl font-heading">
            Team{" "}
            <span className="ares-cut inline-block bg-ares-red px-6 py-1.5 font-bold text-white shadow-xl">
              Store
            </span>
          </h1>
          <p className="max-w-2xl text-base md:text-lg font-medium text-marble/85">
            Official team competition merchandise and season booster pre-orders. 100% of proceeds fund student travel, robot hardware, and STEM community outreach.
          </p>
        </header>

        {/* Booster Pre-Order Notice Banner */}
        <section
          aria-labelledby="booster-notice-title"
          className="hero-card mb-10 border border-ares-gold/40 bg-ares-gold/5 p-6 md:p-8"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-ares-gold">
                <Lock className="h-4 w-4" aria-hidden="true" />
                <span id="booster-notice-title">Season Booster Pre-Order Portal</span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white font-heading">
                Zero Online Payment Processing • 100% Team Booster Support
              </h2>
              <p className="text-xs md:text-sm text-marble/80 leading-relaxed">
                To protect your financial security, we collect zero payment cards or banking PII on this site. Submitting a pre-order reserves your gear and notifies our team booster coordinators for pit pickup or Morgantown hand-off.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSizeGuideOpen(true)}
                className="inline-flex items-center gap-2 rounded border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <Ruler className="h-4 w-4 text-ares-gold" aria-hidden="true" />
                <span>Size Guide</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                data-testid="header-cart-button"
                aria-label={`Open pre-order cart with ${totalCartCount} items`}
                className="inline-flex items-center gap-2 rounded bg-ares-red hover:bg-ares-bronze px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-xl transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                <span>Pre-Order Cart ({totalCartCount})</span>
              </button>
            </div>
          </div>
        </section>

        {/* Filter and Search Bar */}
        <section aria-labelledby="catalog-controls" className="mb-8 space-y-4">
          <h2 id="catalog-controls" className="sr-only">Catalog Controls</h2>
          
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Category Pills */}
            <div
              role="group"
              aria-label="Filter merchandise by category"
              className="flex flex-wrap items-center gap-2"
            >
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                    selectedCategory === category
                      ? "bg-ares-gold text-obsidian font-black shadow-md"
                      : "bg-white/5 text-marble/70 hover:bg-white/10 hover:text-white border border-white/10"
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan`}
                >
                  {CATEGORY_LABELS[category]}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-marble/40 pointer-events-none" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search jerseys, hoodies, caps..."
                aria-label="Search merchandise catalog"
                className="w-full rounded-full border border-white/10 bg-white/5 pl-9 pr-4 py-2 text-xs text-white placeholder-marble/40 focus:border-ares-red focus:outline-none focus:ring-2 focus:ring-ares-red transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-marble/60 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Product Catalog Grid */}
        <section aria-labelledby="merchandise-catalog-heading" className="mb-16">
          <h2 id="merchandise-catalog-heading" className="sr-only">
            Merchandise Catalog
          </h2>

          {filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-12 text-center">
              <Package className="mx-auto mb-4 h-12 w-12 text-marble/40" aria-hidden="true" />
              <h3 className="text-lg font-black uppercase text-white font-heading">
                No items match your search
              </h3>
              <p className="mt-2 text-xs text-marble/70">
                Try searching for a different keyword or reset your category filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("all");
                  setSearchQuery("");
                }}
                className="mt-6 rounded border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-ares-gold hover:bg-white/10"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-testid="store-product-grid">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                  onOpenSizeGuide={() => setIsSizeGuideOpen(true)}
                />
              ))}
            </div>
          )}
        </section>

        {/* How Booster Pre-Orders Work */}
        <section aria-labelledby="how-it-works-title" className="mb-16 rounded-xl border border-ares-bronze/30 bg-white/[0.02] p-8 md:p-10">
          <div className="max-w-2xl mb-8">
            <p className="text-xs font-black uppercase tracking-widest text-ares-gold mb-1">
              Transparent Operations
            </p>
            <h2 id="how-it-works-title" className="text-2xl md:text-3xl font-black text-white font-heading">
              How Booster Pre-Orders Work
            </h2>
            <p className="mt-2 text-xs md:text-sm text-marble/80">
              Every shirt, hoodie, and sticker ordered helps high school engineers compete at FIRST Tech Challenge tournaments.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-5 space-y-2">
              <div className="font-mono text-2xl font-black text-ares-red">01</div>
              <h3 className="text-sm font-black text-white uppercase">Choose Gear</h3>
              <p className="text-xs text-marble/70">
                Select your apparel sizes and quantities from the team catalog.
              </p>
            </div>

            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-5 space-y-2">
              <div className="font-mono text-2xl font-black text-ares-gold">02</div>
              <h3 className="text-sm font-black text-white uppercase">Submit Inquiry</h3>
              <p className="text-xs text-marble/70">
                Submit your pre-order contact inquiry without entering financial details.
              </p>
            </div>

            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-5 space-y-2">
              <div className="font-mono text-2xl font-black text-ares-cyan">03</div>
              <h3 className="text-sm font-black text-white uppercase">Pit / Lab Hand-off</h3>
              <p className="text-xs text-marble/70">
                Our booster coordinator coordinates pickup at upcoming robotics events.
              </p>
            </div>

            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-5 space-y-2">
              <div className="font-mono text-2xl font-black text-ares-bronze">04</div>
              <h3 className="text-sm font-black text-white uppercase">Fuel the Robot</h3>
              <p className="text-xs text-marble/70">
                100% of merchandise proceeds power team travel and robot hardware.
              </p>
            </div>
          </div>
        </section>

        {/* Other Support Channels */}
        <section aria-labelledby="support-title" className="mt-10">
          <div className="mb-6 max-w-2xl">
            <h2 id="support-title" className="text-2xl font-black text-white md:text-3xl font-heading">
              Additional Ways to Support ARES
            </h2>
            <p className="mt-2 text-marble/85 text-xs md:text-sm">
              Discover partnership, sponsorship, and mentorship opportunities with Team 23247.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <Link
              to="/sponsors#sponsor-form-section"
              className="hero-card group border border-ares-gold/40 bg-white/5 p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan transition-all hover:bg-white/10"
            >
              <HandHeart aria-hidden="true" className="mb-4 h-8 w-8 text-ares-gold" />
              <h3 className="text-lg font-black text-white">Sponsor the Team</h3>
              <p className="mt-2 text-xs text-marble/80">
                Explore corporate sponsorship, grants, or in-kind machining partnerships.
              </p>
              <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-ares-gold">
                View sponsor tiers <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </span>
            </Link>

            <Link
              to="/join"
              className="hero-card group border border-ares-cyan/40 bg-white/5 p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan transition-all hover:bg-white/10"
            >
              <Users aria-hidden="true" className="mb-4 h-8 w-8 text-ares-cyan" />
              <h3 className="text-lg font-black text-white">Join ARES</h3>
              <p className="mt-2 text-xs text-marble/80">
                Students and adult technical mentors can get involved with the team.
              </p>
              <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-ares-cyan">
                Visit join page <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </span>
            </Link>

            <a
              href={`mailto:${siteConfig.contact.email}?subject=${encodeURIComponent("Supporting ARES 23247")}`}
              className="hero-card group border border-ares-bronze/40 bg-white/5 p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan transition-all hover:bg-white/10"
            >
              <Mail aria-hidden="true" className="mb-4 h-8 w-8 text-ares-gold" />
              <h3 className="text-lg font-black text-white">Contact the Team</h3>
              <p className="mt-2 text-xs text-marble/80">
                Ask about competition schedules, STEM outreach workshops, or community events.
              </p>
              <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-ares-gold">
                Email executive board <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </span>
            </a>
          </div>
        </section>
      </div>

      {/* Size Guide Modal */}
      <SizeGuideModal
        isOpen={isSizeGuideOpen}
        onClose={() => setIsSizeGuideOpen(false)}
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        catalog={OFFICIAL_MERCH_CATALOG}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onProceedToCheckout={handleProceedToPreOrder}
      />

      {/* Pre-Order Submission Modal */}
      <PreOrderModal
        isOpen={isPreOrderOpen}
        onClose={() => setIsPreOrderOpen(false)}
        items={cartItems}
        catalog={OFFICIAL_MERCH_CATALOG}
        onOrderSuccess={handleOrderSuccess}
      />
    </div>
  );
}
