"use client";

import React, { useState, useEffect } from "react";
import { generateTopDownSnapshot } from "../utils/threeSnapshot";
import { FieldConfig } from "../page";

export function useFieldLoader({
  configs,
  selectedConfigId,
  setLoading,
}: {
  configs: FieldConfig[];
  selectedConfigId: string;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [localBgFile, setLocalBgFile] = useState<File | null>(null);
  const [localGlbFile, setLocalGlbFile] = useState<File | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [rawUploadedImage, setRawUploadedImage] = useState<HTMLImageElement | null>(null);
  const [showCropModal, setShowCropModal] = useState<boolean>(false);

  const handleGlbFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLocalGlbFile(file);
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const buffer = event.target?.result as ArrayBuffer;
        if (!buffer) return;
        try {
          const snapshotBlob = await generateTopDownSnapshot(buffer);
          const snapshotFile = new File([snapshotBlob], "snapshot_bg.png", { type: "image/png" });
          setLocalBgFile(snapshotFile);
        } catch (snapErr) {
          console.error("Failed to generate top-down snapshot from GLB:", snapErr);
          alert("Selected 3D file, but failed to generate a top-down preview. You can manually upload a 2D image instead.");
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Error reading GLB file:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBgFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          setRawUploadedImage(img);
          setShowCropModal(true);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (localBgFile) {
      const url = URL.createObjectURL(localBgFile);
      const img = new Image();
      img.src = url;
      img.onload = () => setBgImage(img);
      return () => URL.revokeObjectURL(url);
    } else {
      const activeConfig = configs.find((c) => c.id === selectedConfigId);
      const bgUrl = activeConfig?.bgImageUrl || "";
      if (bgUrl) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = bgUrl;
        img.onload = () => setBgImage(img);
        img.onerror = () => setBgImage(null);
      } else {
        setBgImage(null);
      }
    }
  }, [localBgFile, selectedConfigId, configs]);

  const resetLoader = () => {
    setLocalBgFile(null);
    setLocalGlbFile(null);
  };

  return {
    localBgFile,
    setLocalBgFile,
    localGlbFile,
    setLocalGlbFile,
    bgImage,
    setBgImage,
    rawUploadedImage,
    setRawUploadedImage,
    showCropModal,
    setShowCropModal,
    handleGlbFileChange,
    handleBgFileChange,
    resetLoader,
  };
}
