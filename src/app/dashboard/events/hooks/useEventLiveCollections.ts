import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebaseFirestore";
import { logger } from "@/utils/logger";
import type { EventPhoto, EventSignup } from "./useEventEditor";

interface UseEventLiveCollectionsOptions {
  editId: string | null;
  isOpen: boolean;
  occurrenceDate: string | null;
  reportError: Dispatch<SetStateAction<string | null>>;
}

/** Owns the two live, event-scoped collections used by the editor tabs. */
export function useEventLiveCollections({
  editId,
  isOpen,
  occurrenceDate,
  reportError,
}: UseEventLiveCollectionsOptions) {
  const [signups, setSignups] = useState<EventSignup[]>([]);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);

  useEffect(() => {
    setSignups([]);
    if (!editId || !isOpen) return;

    const signupsRef = collection(db, "events", editId, "signups");
    return onSnapshot(
      signupsRef,
      (snapshot) => {
        setSignups(
          snapshot.docs.map((docSnap) => ({
            userId: docSnap.id,
            ...docSnap.data(),
          })) as EventSignup[],
        );
      },
      (error) => {
        logger.warn("Unable to fetch event signups:", error);
        reportError(
          `Sign-up list unavailable: ${error instanceof Error ? error.message : String(error)}`,
        );
      },
    );
  }, [editId, isOpen, reportError]);

  useEffect(() => {
    setPhotos([]);
    if (!editId || !isOpen) return;

    const photosRef = collection(db, "events", editId, "photos");
    const photosQuery = query(photosRef, orderBy("uploadedAt", "desc"));
    return onSnapshot(
      photosQuery,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const sourcePhotoId =
            typeof data.sourcePhotoId === "string" && data.sourcePhotoId
              ? data.sourcePhotoId
              : docSnap.id;
          const encodedPhotoId = encodeURIComponent(sourcePhotoId);
          const mediaBase = `/api/photos/admin/media/${encodedPhotoId}`;
          return {
            id: docSnap.id,
            ...data,
            url: `${mediaBase}/original`,
            thumbnailUrl: `${mediaBase}/thumbnail`,
            mediumUrl: `${mediaBase}/medium`,
            publicationStatus:
              data.publicationStatus === "published" ? "published" : "pending",
          } as EventPhoto;
        });
        setPhotos(
          list.filter(
            (photo) =>
              photo.isDeleted !== 1 &&
              (!occurrenceDate ||
                !photo.occurrenceDate ||
                photo.occurrenceDate === occurrenceDate),
          ),
        );
      },
      (error) => {
        logger.warn("Unable to fetch event photos:", error);
        reportError(
          `Event gallery unavailable: ${error instanceof Error ? error.message : String(error)}`,
        );
      },
    );
  }, [editId, isOpen, occurrenceDate, reportError]);

  return { signups, photos };
}
