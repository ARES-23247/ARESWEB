"use client";

import React, { useState, useRef } from "react";
import { Upload, Sparkles } from "lucide-react";
import { resizeAndCompressImage } from "@/lib/image";
import { authenticatedFetch } from "@/lib/api";
import { PhotoAlbum } from "./AlbumExplorer";
import UploadProgressPanel, { UploadStatusItem } from "./UploadProgressPanel";

interface PhotosBatchActionsProps {
  canEdit: boolean;
  albums: PhotoAlbum[];
  isLive: boolean;
  setImportedPhotos: React.Dispatch<React.SetStateAction<any[]>>;
  fetchAlbums: () => Promise<void>;
}

export default function PhotosBatchActions({
  canEdit,
  albums,
  isLive,
  setImportedPhotos,
  fetchAlbums,
}: PhotosBatchActionsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadAlbumId, setUploadAlbumId] = useState<string>("");
  const [runAiIngest, setRunAiIngest] = useState(true);
  const [uploadStatusList, setUploadStatusList] = useState<UploadStatusItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    uploadBatchFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    uploadBatchFiles(files);
  };

  const uploadBatchFiles = async (files: File[]) => {
    const validImageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (validImageFiles.length === 0) {
      alert("Please select valid image files.");
      return;
    }

    // Initialize progress indicators
    const initialStatuses = validImageFiles.map((f) => ({ name: f.name, status: "pending" as const }));
    setUploadStatusList((prev) => [...initialStatuses, ...prev]);

    // Process files sequentially
    for (const file of validImageFiles) {
      setUploadStatusList((prev) =>
        prev.map((s) => (s.name === file.name ? { ...s, status: "uploading" } : s))
      );

      try {
        const { base64, mimeType } = await resizeAndCompressImage(file);

        // If we converted/resized HEIC/HEIF or PNG to JPEG, adjust the file name extension
        const originalName = file.name;
        let finalFilename = originalName;
        if (mimeType === "image/jpeg") {
          const dotIdx = originalName.lastIndexOf(".");
          if (dotIdx !== -1) {
            const ext = originalName.substring(dotIdx).toLowerCase();
            if (ext !== ".jpg" && ext !== ".jpeg") {
              finalFilename = originalName.substring(0, dotIdx) + ".jpg";
            }
          } else {
            finalFilename = originalName + ".jpg";
          }
        }

        const res = await authenticatedFetch("/api/photos/upload-unified", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileBase64: base64,
            filename: finalFilename,
            mimeType,
            albumId: uploadAlbumId || null,
            uploadToGoogle: isLive,
            runAiLabeling: runAiIngest,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setImportedPhotos((prev) => [data.photo, ...prev]);
          setUploadStatusList((prev) =>
            prev.map((s) => (s.name === file.name ? { ...s, status: "success" } : s))
          );
          fetchAlbums(); // Refresh albums to update counts
        } else {
          const errText = await res.text();
          throw new Error(errText || "Backend upload failed");
        }
      } catch (err: any) {
        console.error("Upload error for file:", file.name, err);
        setUploadStatusList((prev) =>
          prev.map((s) =>
            s.name === file.name ? { ...s, status: "error", error: err.message } : s
          )
        );
      }
    }
  };

  if (!canEdit) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Drag and Drop Zone */}
      <div className="lg:col-span-2 flex flex-col">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 transition-all cursor-pointer min-h-[160px] ${
            isDragging
              ? "border-ares-cyan bg-ares-cyan/5 text-white scale-[1.01]"
              : "border-white/10 hover:border-ares-red/40 bg-black/20 hover:bg-black/30 text-marble/55 hover:text-marble/85"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept="image/*"
            className="hidden"
          />
          <Upload size={24} className="mb-3 text-ares-gold" />
          <p className="text-xs uppercase font-extrabold tracking-widest text-center">
            Drag & Drop Photos Here or Click to Browse
          </p>
          <p className="text-[10px] text-marble/40 mt-1">Supports JPEG, PNG, WEBP, and raw image files</p>
        </div>
      </div>

      {/* Upload settings */}
      <div className="lg:col-span-1 glass-card p-6 border border-white/10 flex flex-col justify-between space-y-4">
        <div>
          <h3 className="text-xs font-black uppercase text-ares-gold tracking-widest mb-3 border-b border-white/5 pb-2">
            Ingest Settings
          </h3>
          <div className="space-y-3">
            {/* Select Album */}
            <div>
              <label htmlFor="batch-album" className="block text-[9px] font-black uppercase tracking-wider mb-1 text-marble/60">
                Add to Album
              </label>
              <select
                id="batch-album"
                value={uploadAlbumId}
                onChange={(e) => setUploadAlbumId(e.target.value)}
                className="w-full bg-obsidian/70 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-ares-red"
              >
                <option value="">Unassigned (No Album)</option>
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Checkboxes */}
            <div className="space-y-2 pt-1.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={runAiIngest}
                  onChange={(e) => setRunAiIngest(e.target.checked)}
                  className="accent-ares-red h-3.5 w-3.5"
                />
                <span className="text-[10px] font-bold uppercase text-marble/75 flex items-center gap-1">
                  Auto-generate AI caption & tags <Sparkles size={10} className="text-ares-gold" />
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Upload Status Panel */}
        <UploadProgressPanel uploadStatusList={uploadStatusList} />
      </div>
    </div>
  );
}
