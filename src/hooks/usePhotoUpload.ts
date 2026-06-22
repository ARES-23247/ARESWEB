import { useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";
import { storage, db } from "@/lib/firebase";

export function usePhotoUpload() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadDirect = async (file: File): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      if (!storage) throw new Error("Storage not configured.");
      const cleanName = file.name.toLowerCase().replace(/[^a-z0-9.]/g, "-");
      const storageKey = `editor/uploads/${Date.now()}_${cleanName}`;
      const imageRef = ref(storage, storageKey);
      const snapshot = await uploadBytes(imageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      return downloadUrl;
    } catch (err: any) {
      setError(err.message || "Direct upload failed.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const uploadCropped = async (
    blob: Blob,
    fileName: string
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      if (!storage) throw new Error("Storage not configured.");
      const cleanName = fileName.toLowerCase().replace(/[^a-z0-9.]/g, "-");
      const storageKey = `blog/thumbnails/thumb-${Date.now()}-${cleanName}`;
      const imageRef = ref(storage, storageKey);

      const snapshot = await uploadBytes(imageRef, blob, { contentType: "image/jpeg" });
      const downloadUrl = await getDownloadURL(snapshot.ref);

      const docId = `thumb-${Date.now()}`;
      await setDoc(doc(db, "imported_photos", docId), {
        id: docId,
        publicUrl: downloadUrl,
        storagePath: storageKey,
        originalFilename: `thumb-${fileName}`,
        mimeType: "image/jpeg",
        fileSize: blob.size,
        importedAt: new Date().toISOString(),
        albumId: "blog-thumbnails",
      });

      return downloadUrl;
    } catch (err: any) {
      setError(err.message || "Cropped photo upload failed.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    uploadDirect,
    uploadCropped,
    loading,
    error,
    setError,
  };
}
