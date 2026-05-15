import React from "react";
import { Plus, ShoppingBag } from "lucide-react";
import { Product } from "@shared/routes/store";
import { useCartStore } from "../../store/useCartStore";

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addItem } = useCartStore();

  return (
    <div className="bg-black/40 border border-white/5 ares-cut-lg overflow-hidden hover:border-ares-red/50 transition-all duration-500 group flex flex-col h-full backdrop-blur-sm shadow-2xl relative">
      <div className="absolute top-0 right-0 w-24 h-24 bg-ares-red/5 rounded-full blur-3xl group-hover:bg-ares-red/10 transition-colors"></div>
      
      <div className="aspect-square bg-white/5 relative overflow-hidden border-b border-white/5">
        {product.imageUrl ? (
          <img 
            src={product.imageUrl} 
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-marble/10">
            <ShoppingBag size={48} strokeWidth={1} />
          </div>
        )}
        <div className="absolute top-4 right-4 bg-ares-gold text-black px-3 py-1 ares-cut-sm font-black text-[10px] uppercase tracking-widest shadow-xl">
           ${(product.priceCents / 100).toFixed(2)}
        </div>
      </div>
      
      <div className="p-6 flex flex-col flex-1 relative z-10">
        <h3 className="font-black text-xl text-white mb-2 leading-tight uppercase tracking-tight group-hover:text-ares-red transition-colors">
          {product.name}
        </h3>
        
        {product.description && (
          <p className="text-marble/40 text-xs mb-6 line-clamp-2 flex-1 font-medium leading-relaxed">
            {product.description}
          </p>
        )}
        
        <button
          onClick={() => addItem(product)}
          className="clipped-button w-full bg-white/5 hover:bg-ares-red text-marble/60 hover:text-white border border-white/10 hover:border-ares-red/50 transition-all"
        >
          <Plus className="w-4 h-4 mr-2" />
          Provision Item
        </button>
      </div>
    </div>
  );
};
