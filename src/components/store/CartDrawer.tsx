import React, { useState } from "react";
import { X, ShoppingCart, Plus, Minus, Loader2, ShoppingBag } from "lucide-react";
import { useCartStore } from "../../store/useCartStore";
import { useCreateCheckoutSession } from "../../api/store";

export const CartDrawer: React.FC = () => {
  const { items, isOpen, setIsOpen, updateQuantity, removeItem, getCartTotal } = useCartStore();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const checkoutMutation = useCreateCheckoutSession();

  if (!isOpen) return null;

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setIsCheckingOut(true);
    try {
      const data = await checkoutMutation.mutateAsync({
        items: items.map(item => ({
          productId: item.product.id,
          quantity: item.quantity
        })),
        successUrl: `${window.location.origin}/store?success=true`,
        cancelUrl: `${window.location.origin}/store?cancel=true`
      });
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Checkout failed. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Checkout failed. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <>
      <button 
        type="button"
        className="fixed inset-0 bg-black/80 z-40 backdrop-blur-md transition-opacity w-full border-none cursor-default"
        onClick={() => setIsOpen(false)}
        aria-label="Close cart backdrop"
      />
      <div className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-obsidian border-l border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] z-50 flex flex-col transform transition-transform duration-500 ease-[0.23, 1, 0.32, 1]">
        
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-ares-red/10 ares-cut-sm border border-ares-red/20">
              <ShoppingCart className="w-6 h-6 text-ares-red" />
            </div>
            <div>
              <h2 className="font-black text-xl text-white uppercase tracking-tighter">Your Manifest</h2>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/30">
                {items.length} {items.length === 1 ? 'Deployment' : 'Deployments'}
              </span>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-3 text-marble/20 hover:text-ares-red hover:bg-ares-red/10 ares-cut-sm transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-marble/20 space-y-6">
              <ShoppingCart className="w-24 h-24 opacity-10" />
              <p className="font-black uppercase tracking-widest text-sm">Manifest is empty</p>
              <button 
                onClick={() => setIsOpen(false)}
                className="clipped-button-sm bg-white/5 text-marble/40 hover:text-white border border-white/10"
              >
                Return to Forge
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.product.id} className="flex gap-6 bg-black/40 p-5 ares-cut-lg border border-white/5 group">
                <div className="w-24 h-24 bg-white/5 ares-cut-sm overflow-hidden flex-shrink-0 border border-white/5">
                  {item.product.imageUrl ? (
                    <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-marble/10">
                       <ShoppingBag size={32} />
                    </div>
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-between py-1">
                  <div>
                    <h3 className="font-black text-white uppercase tracking-tight leading-tight group-hover:text-ares-red transition-colors">{item.product.name}</h3>
                    <p className="text-ares-cyan font-black text-sm mt-2 tracking-widest">
                      ${(item.product.priceCents / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-4 bg-black/40 ares-cut-sm border border-white/5 p-1">
                      <button 
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="p-2 hover:bg-white/5 ares-cut-sm text-marble/40 hover:text-white transition-all"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-black text-white w-6 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="p-2 hover:bg-white/5 ares-cut-sm text-marble/40 hover:text-white transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.product.id)}
                      className="text-[10px] font-black uppercase tracking-widest text-ares-red/40 hover:text-ares-red transition-colors"
                    >
                      Eject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-8 border-t border-white/10 bg-black/40 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-8">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-marble/40">Total Valuation</span>
              <span className="text-3xl font-black text-white tracking-tighter">
                ${(getCartTotal() / 100).toFixed(2)}
              </span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className="clipped-button w-full bg-ares-red text-white py-4 shadow-2xl shadow-ares-red/20 hover:shadow-ares-red/40 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isCheckingOut ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin mr-3" />
                  Processing...
                </>
              ) : (
                <>
                  Confirm Deployment
                  <Plus size={20} className="ml-2 group-hover:rotate-90 transition-transform" />
                </>
              )}
            </button>
            <div className="mt-6 text-center">
               <span className="text-[8px] font-black uppercase tracking-[0.4em] text-marble/10">Secure Checkout // Stripe Terminal</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
