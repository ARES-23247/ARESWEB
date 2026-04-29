import React, { useState } from "react";
import { X, ShoppingCart, Plus, Minus, Loader2 } from "lucide-react";
import { useCartStore } from "../../store/useCartStore";
import { api } from "../../api/client";

export const CartDrawer: React.FC = () => {
  const { items, isOpen, setIsOpen, updateQuantity, removeItem, getCartTotal } = useCartStore();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const checkoutMutation = api.store.createCheckoutSession.useMutation();

  if (!isOpen) return null;

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setIsCheckingOut(true);
    try {
      const response = await checkoutMutation.mutateAsync({
        body: {
          items: items.map(item => ({
            productId: item.product.id,
            quantity: item.quantity
          })),
          successUrl: `${window.location.origin}/store?success=true`,
          cancelUrl: `${window.location.origin}/store?cancel=true`
        }
      });
      if (response.status === 200 && response.body.url) {
        window.location.href = response.body.url;
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
      <div 
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      />
      <div className="fixed inset-y-0 right-0 w-full md:w-[400px] bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-ares-gold" />
            <h2 className="font-heading font-bold text-lg text-white">Your Cart</h2>
            <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full ml-2">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
              <ShoppingCart className="w-16 h-16 opacity-20" />
              <p>Your cart is empty.</p>
              <button 
                onClick={() => setIsOpen(false)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.product.id} className="flex gap-4 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                <div className="w-20 h-20 bg-slate-800 rounded-lg overflow-hidden flex-shrink-0">
                  {item.product.image_url ? (
                    <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      No Image
                    </div>
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-white leading-tight">{item.product.name}</h3>
                    <p className="text-ares-gold font-mono mt-1">
                      ${(item.product.price_cents / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3 bg-slate-900 rounded-lg border border-slate-700 p-1">
                      <button 
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-mono text-white w-4 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button 
                      onClick={() => removeItem(item.product.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="p-4 border-t border-slate-800 bg-slate-900/90 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400">Subtotal</span>
              <span className="text-xl font-bold text-white font-mono">
                ${(getCartTotal() / 100).toFixed(2)}
              </span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className="w-full bg-ares-gold hover:bg-yellow-500 text-black font-bold py-3 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(255,183,27,0.2)] hover:shadow-[0_0_25px_rgba(255,183,27,0.4)] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isCheckingOut ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                "Proceed to Checkout"
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
};
