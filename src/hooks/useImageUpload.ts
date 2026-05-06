import { useState } from "react";
import { compressImage } from "../utils/imageProcessor";
import { uploadFile as apiClientUploadFile } from "../api";

export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const uploadFile = async (file: File): Promise<{url: string, altText?: string}> => {
    if (isUploading) throw new Error("An upload is already in progress.");
    setIsUploading(true);
    setErrorMsg("");
    try {
      const { blob: compressedBlob, ext } = await compressImage(file);
      const formData = new FormData();
      formData.append("file", compressedBlob, file.name.replace(/\.[^/.]+$/, ext));
      
      const res = await apiClientUploadFile<{ url: string, altText?: string }>("/api/media", formData);
      return { url: res.url, altText: res.altText };
    } catch (err) {
      const msg = String(err);
      setErrorMsg(msg);
      throw new Error(msg, { cause: err });
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFile, isUploading, errorMsg, setErrorMsg };
}
