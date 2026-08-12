import React, { useCallback, useEffect, useState, useMemo } from "react";
import { collection, doc, onSnapshot, setDoc, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebaseFirestore";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { resizeAndCompressImage } from "@/lib/image";
import { cleanUndefined } from "@/lib/utils";
import { logger } from "@/utils/logger";
import { TeamEvent } from "@/types/event";
import { TeamLocation } from "../components/LocationManagerModal";
import { archiveEvent, createEvent, restoreEvent, updateEvent, type EventWriteInput } from "@/app/calendar/api";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

export interface EventRevision {
  id: string;
  title: string;
  dateStart: string;
  dateEnd?: string;
  locationId?: string;
  description?: string;
  category: "internal" | "outreach";
  coverImage?: string;
  isPotluck?: number;
  isVolunteer?: number;
  isDeleted?: number;
  status?: "published" | "draft" | "pending";
  editedBy: string;
  editedByName: string;
  editedByAvatar: string;
  timestamp: string;
}

export interface EventSignup {
  userId: string;
  nickname: string;
  bringing?: string;
  notes?: string;
  prepHours?: number;
  attended?: boolean;
}

export interface EventPhoto {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
  mediumUrl?: string | null;
  uploadedBy: string;
  uploadedAt: string;
  filename: string;
  googleMediaItemId?: string;
  isDeleted?: number;
}

interface EventEditorUserProfile {
  nickname?: string;
  avatar?: string;
}

interface UseEventEditorProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit: TeamEvent | null;
  locations: TeamLocation[];
  setLocations: React.Dispatch<React.SetStateAction<TeamLocation[]>>;
  teamMembers: { uid: string; nickname: string; avatar: string; }[];
}

export function useEventEditor({
  isOpen,
  onClose,
  eventToEdit,
  locations,
  setLocations: _setLocations,
  teamMembers
}: UseEventEditorProps) {
  const { user, authorizedUser } = useAuth();

  // Form states
  const [formTitle, setFormTitle] = useState("");
  const [formDateStart, setFormDateStart] = useState("");
  const [formDateEnd, setFormDateEnd] = useState("");
  const [formLocationId, setFormLocationId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<"internal" | "outreach">("internal");
  const [formCoverImage, setFormCoverImage] = useState("");
  const [formIsPotluck, setFormIsPotluck] = useState<number>(0);
  const [formIsVolunteer, setFormIsVolunteer] = useState<number>(0);
  const [formStatus, setFormStatus] = useState<"published" | "pending" | "draft">("published");

  // Modal display states
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "roster" | "photos" | "revisions">("edit");
  const [showAiSidebar, setShowAiSidebar] = useState(false);
  const [revertAlert, setRevertAlert] = useState<string | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // RSVP, Photos, Revisions list states
  const [signups, setSignups] = useState<EventSignup[]>([]);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [revisions, setRevisions] = useState<EventRevision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  // Photo uploading states
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<EventPhoto | null>(null);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const editId = eventToEdit?.id || null;
  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");
  const isAdmin = !!(user && authorizedUser && (authorizedUser.role === "admin" || authorizedUser.role === "coach"));
  const profileQuery = useCurrentProfile(user?.uid);
  const userProfile = useMemo<EventEditorUserProfile | null>(() => profileQuery.data
    ? {
        nickname: profileQuery.data.profile.nickname,
        avatar: profileQuery.data.profile.avatar,
      }
    : null, [profileQuery.data]);
  const userNickname = userProfile?.nickname || "ARES Member";
  
  const canPublishDirectly = useMemo(() => {
    return !!(user && authorizedUser && ["admin", "coach", "mentor"].includes(authorizedUser.role));
  }, [user, authorizedUser]);

  // Preserve an explicit editor error when the shared profile DTO is unavailable.
  useEffect(() => {
    if (!profileQuery.error) return;
    logger.error("Failed to load user profile:", profileQuery.error);
    setOperationError(`Profile details unavailable: ${profileQuery.error instanceof Error ? profileQuery.error.message : String(profileQuery.error)}`);
  }, [profileQuery.error]);

  // Sync state with eventToEdit when it changes
  useEffect(() => {
    if (isOpen) {
      if (eventToEdit) {
        setFormTitle(eventToEdit.title);
        setFormDateStart(eventToEdit.dateStart ? eventToEdit.dateStart.slice(0, 16) : "");
        setFormDateEnd(eventToEdit.dateEnd ? eventToEdit.dateEnd.slice(0, 16) : "");
        setFormLocationId(eventToEdit.locationId || "");
        setFormDescription(eventToEdit.description || "");
        setFormCategory(eventToEdit.category);
        setFormCoverImage(eventToEdit.coverImage || "");
        setFormIsPotluck(eventToEdit.isPotluck || 0);
        setFormIsVolunteer(eventToEdit.isVolunteer || 0);
        setFormStatus(eventToEdit.status || "published");
      } else {
        // Create Mode
        setFormTitle("");
        setFormDateStart(new Date().toISOString().slice(0, 16));
        setFormDateEnd(new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16));
        setFormLocationId("");
        setFormDescription("");
        setFormCategory("internal");
        setFormCoverImage("");
        setFormIsPotluck(0);
        setFormIsVolunteer(0);
        setFormStatus(canPublishDirectly ? "published" : "pending");
      }

      // Reset modal UI states
      setIsFullScreen(false);
      setActiveTab("edit");
      setShowAiSidebar(false);
      setRevertAlert(null);
      setSignups([]);
      setPhotos([]);
      setRevisions([]);
      setOperationError(null);
    }
  }, [isOpen, eventToEdit, canPublishDirectly]);

  // Fetch event signups in real-time
  useEffect(() => {
    if (!editId || !isOpen) return;
    const signupsRef = collection(db, "events", editId, "signups");
    const unsubscribe = onSnapshot(
      signupsRef,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          userId: docSnap.id,
          ...docSnap.data()
        })) as EventSignup[];
        setSignups(list);
      },
      (err) => {
        console.warn("Unable to fetch event signups:", err);
      }
    );
    return () => unsubscribe();
  }, [editId, isOpen]);

  // Fetch active event photos in real-time
  useEffect(() => {
    if (!editId || !isOpen) return;
    const photosRef = collection(db, "events", editId, "photos");
    const q = query(photosRef, orderBy("uploadedAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as EventPhoto[];
        setPhotos(list.filter((photo) => photo.isDeleted !== 1));
      },
      (err) => {
        console.warn("Unable to fetch event photos:", err);
        setOperationError(`Event gallery unavailable: ${err.message}`);
      }
    );
    return () => unsubscribe();
  }, [editId, isOpen]);

  const fetchRevisionsList = useCallback(async () => {
    if (!editId) return;
    setLoadingRevisions(true);
    try {
      const q = query(collection(db, "events", editId, "revisions"), orderBy("timestamp", "desc"), limit(50));
      const snap = await getDocs(q);
      const list = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as EventRevision[];
      setRevisions(list);
    } catch (err) {
      console.warn("Could not load revision logs:", err);
      setOperationError(`Revision history unavailable: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingRevisions(false);
    }
  }, [editId]);

  // Fetch event revisions list when tab shifts
  useEffect(() => {
    if (activeTab === "revisions" && editId && isOpen) {
      void fetchRevisionsList();
    }
  }, [activeTab, editId, fetchRevisionsList, isOpen]);

  const displayedMembers = useMemo(() => {
    const list = [...teamMembers];
    if (user && !list.some((m) => m.uid === user.uid)) {
      list.unshift({
        uid: user.uid,
        nickname: userNickname || "ARES Member",
        avatar: userProfile?.avatar || ""
      });
    }
    return list;
  }, [teamMembers, user, userNickname, userProfile]);

  // Action: Save Event
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDateStart) return;
    if (!canEdit) return;

    const selectedLocation = locations.find((location) => location.id === formLocationId);
    const newEvent: EventWriteInput = {
      title: formTitle.trim(),
      dateStart: formDateStart,
      dateEnd: formDateEnd || undefined,
      locationId: formLocationId || undefined,
      location: selectedLocation?.name,
      description: formDescription.trim() || undefined,
      category: formCategory,
      coverImage: formCoverImage || undefined,
      isPotluck: formIsPotluck === 1 ? 1 : 0,
      isVolunteer: formIsVolunteer === 1 ? 1 : 0,
      status: canPublishDirectly ? formStatus : "pending"
    };

    setIsSaving(true);
    setOperationError(null);
    try {
      if (editId) await updateEvent(editId, newEvent);
      else await createEvent(newEvent);
      onClose();
    } catch (err: unknown) {
      logger.error("Error saving event:", err);
      setOperationError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!canPublishDirectly || !editId) return;

    setOperationError(null);
    try {
      await archiveEvent(editId);
      onClose();
    } catch (err: unknown) {
      logger.error("Error soft deleting event:", err);
      setOperationError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRestoreEvent = async () => {
    if (!canPublishDirectly || !editId) return;

    setOperationError(null);
    try {
      await restoreEvent(editId);
      onClose();
    } catch (err: unknown) {
      logger.error("Error restoring event:", err);
      setOperationError(err instanceof Error ? err.message : String(err));
    }
  };

  // Action: Revert To Revision
  const handleRevertToRevision = (rev: EventRevision) => {
    setFormTitle(rev.title);
    setFormDateStart(rev.dateStart ? rev.dateStart.slice(0, 16) : "");
    setFormDateEnd(rev.dateEnd ? rev.dateEnd.slice(0, 16) : "");
    setFormLocationId(rev.locationId || "");
    setFormDescription(rev.description || "");
    setFormCategory(rev.category);
    setFormCoverImage(rev.coverImage || "");
    setFormIsPotluck(rev.isPotluck || 0);
    setFormIsVolunteer(rev.isVolunteer || 0);
    setRevertAlert(
      `Reverted unsaved draft to revision from ${new Date(
        rev.timestamp
      ).toLocaleString()}. Save event to commit changes.`
    );
    setActiveTab("edit");
  };

  // Action: Upload Photo
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editId || !user) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadError("Upload a JPEG, PNG, or WebP image.");
      return;
    }
    setUploadingImage(true);
    setUploadError(null);
    try {
      const compressed = await resizeAndCompressImage(file);
      const base64 = compressed.base64;
      const mimeType = compressed.mimeType;

      const res = await authenticatedFetch("/api/photos/upload-unified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: base64,
          filename: file.name,
          mimeType: mimeType || file.type || "image/jpeg",
          uploadToGoogle: true,
          runAiLabeling: false
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${res.statusText || "Request failed"}${errText ? ` — ${errText}` : ""}`);
      }

      const data = await res.json();
      const photoId = data.photo.id || `photo_${Date.now()}`;

      const photoData: EventPhoto = {
        id: photoId,
        url: data.photo.publicUrl,
        thumbnailUrl: typeof data.photo.thumbnailUrl === "string" ? data.photo.thumbnailUrl : null,
        mediumUrl: typeof data.photo.mediumUrl === "string" ? data.photo.mediumUrl : null,
        uploadedBy: userNickname || "ARES Member",
        uploadedAt: new Date().toISOString(),
        filename: file.name,
        googleMediaItemId: data.photo.googleMediaItemId || undefined
      };

      await setDoc(doc(db, "events", editId, "photos", photoId), cleanUndefined({ ...photoData }));
      setRevertAlert("Photo uploaded to the event gallery. Google Photos sync runs when the team account is connected.");
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingImage(false);
    }
  };

  // Action: Delete Photo
  const handleDeletePhoto = async (photoId: string) => {
    if (!editId || !canEdit) return;
    try {
      await setDoc(
        doc(db, "events", editId, "photos", photoId),
        { isDeleted: 1, archivedAt: new Date().toISOString() },
        { merge: true },
      );
      setRevertAlert("Photo archived from this event.");
    } catch (err: unknown) {
      logger.error("Failed to delete photo:", err);
      setOperationError(`Photo archive failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return {
    formTitle,
    setFormTitle,
    formDateStart,
    setFormDateStart,
    formDateEnd,
    setFormDateEnd,
    formLocationId,
    setFormLocationId,
    formDescription,
    setFormDescription,
    formCategory,
    setFormCategory,
    formCoverImage,
    setFormCoverImage,
    formIsPotluck,
    setFormIsPotluck,
    formIsVolunteer,
    setFormIsVolunteer,
    formStatus,
    setFormStatus,
    isFullScreen,
    setIsFullScreen,
    activeTab,
    setActiveTab,
    showAiSidebar,
    setShowAiSidebar,
    revertAlert,
    setRevertAlert,
    isLocationModalOpen,
    setIsLocationModalOpen,
    signups,
    photos,
    revisions,
    loadingRevisions,
    operationError,
    isSaving,
    uploadingImage,
    uploadError,
    selectedPhoto,
    setSelectedPhoto,
    isPhotoPickerOpen,
    setIsPhotoPickerOpen,
    userNickname,
    currentUser: user,
    editId,
    canEdit,
    isAdmin,
    canPublishDirectly,
    displayedMembers,
    handleSaveEvent,
    handleDeleteEvent,
    handleRestoreEvent,
    handleRevertToRevision,
    handleImageUpload,
    handleDeletePhoto,
  };
}
