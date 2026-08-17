import { useState } from "react";
import { authenticatedFetch } from "@/lib/api";
import { resizeAndCompressImage } from "@/lib/image";
import { apiFailure, ManagedPhoto } from "@/lib/media";

interface UploadResponse { photo: ManagedPhoto }

export function usePhotoUpload() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("Choose a JPEG, PNG, or WebP image.");
      }
      const compressed = await resizeAndCompressImage(file);
      const filename = compressed.mimeType === "image/jpeg"
        ? file.name.replace(/\.[^.]+$/, "") + ".jpg"
        : file.name;
      const response = await authenticatedFetch("/api/photos/upload-unified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: compressed.base64,
          filename,
          mimeType: compressed.mimeType,
          albumId: null,
          runAiLabeling: false,
        }),
      });
      if (!response.ok) throw await apiFailure(response, "Image upload failed.");
      const payload = await response.json() as UploadResponse;
      return payload.photo.publicUrl;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const uploadDirect = (file: File) => upload(file);
  const uploadCropped = (blob: Blob, fileName: string) => upload(new File([blob], fileName, { type: blob.type || "image/jpeg" }));

  return { uploadDirect, uploadCropped, loading, error, setError };
}
