import React from "react";
import { RefreshCw } from "lucide-react";

interface PathTransformsCardProps {
  handleMirror: (axis: "x" | "y") => void;
  handleRotate: (angleDeg: number) => void;
}

export function PathTransformsCard({
  handleMirror,
  handleRotate,
}: PathTransformsCardProps) {
  return (
    <div className="bg-black/20 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
      <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-1.5">
        <RefreshCw size={14} /> Path Transforms
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleMirror("x")}
          className="py-1.5 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold uppercase tracking-wider border border-white/10 cursor-pointer transition-all duration-300"
        >
          Flip Horiz (X)
        </button>
        <button
          onClick={() => handleMirror("y")}
          className="py-1.5 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold uppercase tracking-wider border border-white/10 cursor-pointer transition-all duration-300"
        >
          Flip Vert (Y)
        </button>
        <button
          onClick={() => handleRotate(90)}
          className="py-1.5 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold uppercase tracking-wider border border-white/10 cursor-pointer transition-all duration-300"
        >
          Rotate +90°
        </button>
        <button
          onClick={() => handleRotate(-90)}
          className="py-1.5 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold uppercase tracking-wider border border-white/10 cursor-pointer transition-all duration-300"
        >
          Rotate -90°
        </button>
      </div>
    </div>
  );
}
export default PathTransformsCard;
