import React, { useEffect } from "react";
import { api } from "../api/client";
import { ShoppingCart, Loader2, Search, CheckCircle2 } from "lucide-react";
import { ProductCard } from "../components/store/ProductCard";
import { CartDrawer } from "../components/store/CartDrawer";
import { useCartStore } from "../store/useCartStore";
import { useSearchParams } from "react-router-dom";

export const Store: React.FC = () => {
  const { data, isLoading, error } = api.store.getProducts.useQuery();
  const { setIsOpen, getCartCount, clearCart } = useCartStore();
  const [searchParams] = useSearchParams();

  const success = searchParams.get("success");
  const cancel = searchParams.get("cancel");

  useEffect(() => {
    if (success) {
      clearCart();
    }
  }, [success, clearCart]);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-300 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-heading font-black text-white mb-4 uppercase tracking-tight">
              ARES <span className="text-ares-gold">Store</span>
            </h1>
            <p className="text-lg text-slate-400">
              Support Team 23247 by grabbing our official team apparel and merchandise.
            </p>
          </div>
          
          <button
            onClick={() => setIsOpen(true)}
            className="relative flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold transition-all border border-slate-700"
          >
            <ShoppingCart className="w-5 h-5" />
            <span>View Cart</span>
            {getCartCount() > 0 && (
              <span className="absolute -top-2 -right-2 bg-ares-gold text-black w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
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

        {/* Filters/Search (Visual only for now) */}
        <div className="mb-8 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search merchandise..." 
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-ares-gold focus:ring-1 focus:ring-ares-gold transition-colors"
              disabled
            />
          </div>
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-ares-gold" />
            <p>Loading inventory...</p>
          </div>
        ) : error ? (
          <div className="py-24 text-center text-red-400 bg-red-400/10 rounded-2xl border border-red-400/20">
            Failed to load products. Please try again later.
          </div>
        ) : !data || data.body.length === 0 ? (
          <div className="py-24 text-center text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
            No products available at the moment. Check back soon!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {data.body.map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>

      <CartDrawer />
    </div>
  );
};

export default Store;
