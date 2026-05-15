import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, ShoppingCart, CheckCircle2 } from 'lucide-react'
import { useGetProducts, type Product } from '@/api/store'
import { ProductCard } from '@/components/store/ProductCard'
import { CartDrawer } from '@/components/store/CartDrawer'
import { useCartStore } from '@/store/useCartStore'
import ProductSchema from '@/components/ProductSchema'
interface UIProduct extends Product {
  category?: string;
}


function StorePage() {
  const { data: productsData, isLoading } = useGetProducts();
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const { setIsOpen, getCartCount, clearCart } = useCartStore();
  const searchParams = useSearch({ strict: false }) as Record<string, string>;

  const success = searchParams.success;
  const cancel = searchParams.cancel;

  useEffect(() => {
    if (success) {
      clearCart();
    }
  }, [success, clearCart]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-ares-red/20 border-t-ares-red animate-spin rounded-full mb-4"></div>
        <div className="text-xs font-black uppercase tracking-[0.2em] text-marble/40">Loading Marketplace...</div>
      </div>
    );
  }

  const products = productsData || [];
  const categories = ["All", ...new Set(products.map((p: UIProduct) => p.category || "Other"))];
  
  const filteredProducts = activeCategory === "All" 
    ? products 
    : products.filter((p: UIProduct) => p.category === activeCategory);

  return (
    <div className="min-h-screen bg-obsidian text-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <ProductSchema products={products} />
      <div className="max-w-7xl mx-auto">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-12">
          <div className="flex-1">
            <div className="inline-block bg-ares-cyan/10 text-ares-cyan px-4 py-1.5 ares-cut-sm font-black uppercase tracking-widest text-[10px] mb-6 border border-ares-cyan/20">
              ARES 23247 Logistics
            </div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter uppercase leading-none">
              ARES <span className="text-transparent bg-clip-text bg-gradient-to-r from-ares-gold to-yellow-500">Store</span>
            </h1>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className="relative flex items-center gap-2 bg-ares-red hover:bg-ares-red/80 text-white px-6 py-3 ares-cut-sm font-black uppercase tracking-widest text-xs transition-all border border-ares-red/50 shadow-lg shadow-ares-red/20"
          >
            <ShoppingCart className="w-5 h-5" />
            <span>View Cart</span>
            {getCartCount() > 0 && (
              <span className="absolute -top-2 -right-2 bg-ares-gold text-black w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg">
                {getCartCount()}
              </span>
            )}
          </button>
        </div>

        {/* Notifications */}
        {success && (
          <div className="mb-8 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-start gap-3 text-green-400">
            <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-green-300">Order Successful!</h3>
              <p className="text-sm opacity-90 mt-1">Thank you for your purchase. You will receive an email confirmation shortly.</p>
            </div>
          </div>
        )}

        {cancel && (
          <div className="mb-8 p-4 bg-slate-800 border border-slate-700 rounded-xl text-slate-300">
            Checkout was cancelled. Your cart has been saved.
          </div>
        )}

        {/* Category Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-6 py-2 ares-cut-sm font-black uppercase tracking-widest text-[10px] transition-all duration-300 border ${
                activeCategory === category
                  ? "bg-ares-red border-ares-red text-white shadow-lg shadow-ares-red/20"
                  : "bg-white/5 border-white/10 text-marble/40 hover:bg-white/10 hover:text-white"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center text-marble/30 p-20 bg-black/40 ares-cut-lg border border-white/5 backdrop-blur-sm">
            <ShoppingBag size={48} className="mx-auto mb-6 opacity-20" />
            <div className="text-xl font-bold uppercase tracking-widest">No Supply Found</div>
            <div className="text-sm mt-2">The selected category is currently out of stock.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            <AnimatePresence mode="popLayout">
              {filteredProducts.map((product: UIProduct) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <CartDrawer />
    </div>
  );
}

export const Route = createFileRoute('/store')({
  component: StorePage,
})
