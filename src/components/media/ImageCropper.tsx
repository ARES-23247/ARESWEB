import React, { useState, useRef } from "react";

interface ImageCropperProps {
  cropImageSrc: string;
  cropFileName: string;
  loading: boolean;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
  onError: (errorMsg: string) => void;
}

export default function ImageCropper({
  cropImageSrc,
  cropFileName,
  loading,
  onCancel,
  onSave,
  onError,
}: ImageCropperProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  // Mouse/Touch Drag Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    const touch = e.touches[0];
    dragStart.current = { x: touch.clientX - offset.x, y: touch.clientY - offset.y };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setOffset({
      x: touch.clientX - dragStart.current.x,
      y: touch.clientY - dragStart.current.y,
    });
  };

  const handleSaveCrop = async () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 450;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create canvas context.");

      const img = new Image();
      img.src = cropImageSrc;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Fill canvas background
      ctx.fillStyle = "#0a0a0c";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      const viewportAspect = 16 / 9;
      const imgAspect = img.width / img.height;

      let drawW = 320;
      let drawH = 180;
      if (imgAspect > viewportAspect) {
        drawH = 180;
        drawW = 180 * imgAspect;
      } else {
        drawW = 320;
        drawH = 320 / imgAspect;
      }

      const sf = 2.5; // scaling factor from viewport h=180 to canvas h=450
      const finalW = drawW * zoom * sf;
      const finalH = drawH * zoom * sf;
      const posX = centerX + offset.x * sf - finalW / 2;
      const posY = centerY + offset.y * sf - finalH / 2;

      ctx.drawImage(img, posX, posY, finalW, finalH);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            onError("Cropping failed.");
            return;
          }
          onSave(blob);
        },
        "image/jpeg",
        0.85
      );
    } catch (err: any) {
      onError(`Cropping failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-xs text-marble/70">
        Drag image to adjust crop. Use zoom slider to fit.
      </div>

      <div
        ref={viewportRef}
        tabIndex={0}
        role="region"
        aria-label="Image cropper, use arrow keys to pan image"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 50 : 10;
          let moved = false;
          if (e.key === "ArrowLeft" || e.key === "Left") {
            setOffset((prev) => ({ ...prev, x: prev.x - step }));
            moved = true;
          } else if (e.key === "ArrowRight" || e.key === "Right") {
            setOffset((prev) => ({ ...prev, x: prev.x + step }));
            moved = true;
          } else if (e.key === "ArrowUp" || e.key === "Up") {
            setOffset((prev) => ({ ...prev, y: prev.y - step }));
            moved = true;
          } else if (e.key === "ArrowDown" || e.key === "Down") {
            setOffset((prev) => ({ ...prev, y: prev.y + step }));
            moved = true;
          }
          if (moved) {
            e.preventDefault();
          }
        }}
        className="relative w-full h-[220px] bg-black border border-white/15 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing flex items-center justify-center select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
      >
        <div className="absolute inset-0 border-2 border-ares-gold/40 pointer-events-none z-10 rounded-md m-2">
          <div className="absolute inset-0 flex justify-between pointer-events-none">
            <div className="h-full w-[1px] border-r border-dashed border-white/20 ml-[33%]" />
            <div className="h-full w-[1px] border-r border-dashed border-white/20 mr-[33%]" />
          </div>
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            <div className="w-full h-[1px] border-b border-dashed border-white/20 mt-[33%]" />
            <div className="w-full h-[1px] border-b border-dashed border-white/20 mb-[33%]" />
          </div>
        </div>

        <img
          src={cropImageSrc}
          alt="Crop Target"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            maxWidth: "none",
            maxHeight: "none",
            userSelect: "none",
            pointerEvents: "none",
            transition: isDragging ? "none" : "transform 0.1s ease",
          }}
          className="w-auto h-full object-contain"
        />
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider text-marble/55">
          <span>Zoom Level</span>
          <span>{zoom.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="1"
          max="4"
          step="0.05"
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="w-full h-1 bg-black/60 rounded-lg appearance-none cursor-pointer accent-ares-gold border border-white/10"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-white/10 hover:bg-white/5 text-marble text-[10px] font-black uppercase tracking-widest ares-cut-sm transition-colors cursor-pointer"
          disabled={loading}
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSaveCrop}
          className="px-5 py-2 bg-ares-gold text-black font-black uppercase tracking-widest text-[10px] ares-cut-sm transition-all hover:scale-102 active:scale-98 cursor-pointer shadow-lg disabled:opacity-40"
          disabled={loading}
        >
          {loading ? "Saving..." : "Apply Crop & Save"}
        </button>
      </div>
    </div>
  );
}
