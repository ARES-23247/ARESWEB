"use client";

import React, { useRef, useEffect, useState } from "react";
import { Sliders } from "lucide-react";

interface CropModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawUploadedImage: HTMLImageElement | null;
  fieldType: "ftc" | "frc";
  onApplyCrop: (croppedFile: File, croppedBgImage: HTMLImageElement) => void;
}

export default function CropModal({
  isOpen,
  onClose,
  rawUploadedImage,
  fieldType,
  onApplyCrop
}: CropModalProps) {
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Crop & Alignment Editor states
  const [cropZoom, setCropZoom] = useState<number>(1.0);
  const [cropOffsetX, setCropOffsetX] = useState<number>(0);
  const [cropOffsetY, setCropOffsetY] = useState<number>(0);
  const [cropRotation, setCropRotation] = useState<number>(0);

  // Render loop for the crop/alignment preview canvas
  useEffect(() => {
    if (!isOpen || !rawUploadedImage) return;
    const canvas = cropCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use a fixed height of 300px in the modal
    const previewH = 300;
    const previewW = fieldType === "ftc" ? 300 : 300 * (8.211 / 16.541);

    // Account for high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = previewW * dpr;
    canvas.height = previewH * dpr;
    ctx.scale(dpr, dpr);

    // Clear and draw background
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, previewW, previewH);

    ctx.save();
    // 1. Center of the preview field
    ctx.translate(previewW / 2, previewH / 2);

    // 2. Apply user alignment settings
    ctx.translate(cropOffsetX, cropOffsetY);
    ctx.rotate((cropRotation * Math.PI) / 180);
    ctx.scale(cropZoom, cropZoom);

    // 3. Draw the original uploaded image centered
    const imgAspect = rawUploadedImage.width / rawUploadedImage.height;
    let imgW = previewW;
    let imgH = previewW / imgAspect;
    if (fieldType === "frc") {
      imgH = previewH;
      imgW = previewH * imgAspect;
    }
    ctx.drawImage(rawUploadedImage, -imgW / 2, -imgH / 2, imgW, imgH);
    ctx.restore();

    // 4. Draw crop boundary overlay
    ctx.strokeStyle = "#F59E0B"; // Gold border for crop area
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, previewW, previewH);

    // Draw a visual dashed grid to help with alignment
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(previewW / 2, 0);
    ctx.lineTo(previewW / 2, previewH);
    ctx.moveTo(0, previewH / 2);
    ctx.lineTo(previewW, previewH / 2);
    ctx.stroke();
  }, [isOpen, rawUploadedImage, cropZoom, cropOffsetX, cropOffsetY, cropRotation, fieldType]);

  const applyCrop = () => {
    if (!rawUploadedImage) return;

    // Set high-quality target resolution
    const targetH = 1024;
    const targetW = fieldType === "ftc" ? 1024 : Math.round(1024 * (8.211 / 16.541));

    const offscreen = document.createElement("canvas");
    offscreen.width = targetW;
    offscreen.height = targetH;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, targetW, targetH);

    ctx.save();
    // 1. Translate to center of offscreen canvas
    ctx.translate(targetW / 2, targetH / 2);

    // 2. Scale slider offsets from preview scale (preview height = 300) to offscreen scale (offscreen height = 1024)
    const scaleFactor = targetH / 300;
    ctx.translate(cropOffsetX * scaleFactor, cropOffsetY * scaleFactor);
    ctx.rotate((cropRotation * Math.PI) / 180);
    ctx.scale(cropZoom, cropZoom);

    // 3. Draw image centered
    const imgAspect = rawUploadedImage.width / rawUploadedImage.height;
    let imgW = targetW;
    let imgH = targetW / imgAspect;
    if (fieldType === "frc") {
      imgH = targetH;
      imgW = targetH * imgAspect;
    }
    ctx.drawImage(rawUploadedImage, -imgW / 2, -imgH / 2, imgW, imgH);
    ctx.restore();

    // Convert to Blob
    offscreen.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "cropped_background.png", { type: "image/png" });
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;
        img.onload = () => {
          onApplyCrop(file, img);
        };
      }
    }, "image/png");
  };

  if (!isOpen || !rawUploadedImage) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card max-w-xl w-full p-6 border border-white/10 bg-neutral-950/90 shadow-2xl flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="text-sm font-black uppercase text-white tracking-widest font-heading flex items-center gap-2">
            <Sliders size={16} className="text-ares-gold" /> Align & Crop Background Image
          </h3>
          <button
            onClick={onClose}
            className="text-marble/40 hover:text-white transition-colors cursor-pointer text-xs"
          >
            ✕ Close
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-center justify-center">
          {/* Canvas Preview */}
          <div className="relative border border-white/10 bg-neutral-900 rounded-xl overflow-hidden shadow-inner flex items-center justify-center p-2">
            <canvas
              ref={cropCanvasRef}
              style={{
                width: fieldType === "ftc" ? "200px" : `${200 * (8.211 / 16.541)}px`,
                height: "200px"
              }}
              className="bg-black shadow-lg"
            />
          </div>

          {/* Slider Controls */}
          <div className="flex-1 w-full space-y-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10px] uppercase font-black tracking-widest text-marble/55">
                <span>Zoom Scale</span>
                <span className="font-mono text-ares-gold">{cropZoom.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5.0"
                step="0.05"
                value={cropZoom}
                onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                className="w-full accent-ares-gold bg-white/10 rounded-lg cursor-pointer h-1"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10px] uppercase font-black tracking-widest text-marble/55">
                <span>Offset X (Horizontal)</span>
                <span className="font-mono text-ares-gold">{cropOffsetX}px</span>
              </div>
              <input
                type="range"
                min="-300"
                max="300"
                step="1"
                value={cropOffsetX}
                onChange={(e) => setCropOffsetX(parseInt(e.target.value))}
                className="w-full accent-ares-gold bg-white/10 rounded-lg cursor-pointer h-1"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10px] uppercase font-black tracking-widest text-marble/55">
                <span>Offset Y (Vertical)</span>
                <span className="font-mono text-ares-gold">{cropOffsetY}px</span>
              </div>
              <input
                type="range"
                min="-300"
                max="300"
                step="1"
                value={cropOffsetY}
                onChange={(e) => setCropOffsetY(parseInt(e.target.value))}
                className="w-full accent-ares-gold bg-white/10 rounded-lg cursor-pointer h-1"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10px] uppercase font-black tracking-widest text-marble/55">
                <span>Rotation Angle</span>
                <span className="font-mono text-ares-gold">{cropRotation}°</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={cropRotation}
                onChange={(e) => setCropRotation(parseInt(e.target.value))}
                className="w-full accent-ares-gold bg-white/10 rounded-lg cursor-pointer h-1"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/5 pt-4">
          <button
            onClick={() => {
              setCropZoom(1.0);
              setCropOffsetX(0);
              setCropOffsetY(0);
              setCropRotation(0);
            }}
            className="px-4 py-2 border border-white/10 hover:border-white/20 text-white rounded-lg text-[9px] uppercase font-black tracking-widest transition-all cursor-pointer font-bold"
          >
            Reset
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-white rounded-lg text-[9px] uppercase font-black tracking-widest transition-all cursor-pointer font-bold"
            >
              Cancel
            </button>
            <button
              onClick={applyCrop}
              className="px-5 py-2 bg-ares-gold text-black hover:bg-ares-gold-soft rounded-lg text-[9px] uppercase font-black tracking-widest transition-all cursor-pointer font-bold"
            >
              Apply Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
