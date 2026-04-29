import React from "react";
import { Plus } from "lucide-react";
import { Product } from "../../../shared/schemas/contracts/storeContract";
import { useCartStore } from "../../store/useCartStore";

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addItem } = useCartStore();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-ares-gold/50 transition-colors group flex flex-col h-full">
      <div className="aspect-square bg-slate-800 relative overflow-hidden">
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            No Image
          </div>
        )}
      </div>
      
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-heading font-bold text-xl text-white mb-2 leading-tight">
          {product.name}
        </h3>
        
        {product.description && (
          <p className="text-slate-400 text-sm mb-4 line-clamp-2 flex-1">
            {product.description}
          </p>
        )}
        
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-800">
          <span className="font-mono font-bold text-ares-gold text-xl">
            ${(product.price_cents / 100).toFixed(2)}
          </span>
          <button
            onClick={() => addItem(product)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-ares-gold text-white hover:text-black px-4 py-2 rounded-xl font-bold transition-all"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
};
