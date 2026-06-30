import React, { useEffect, useState, useMemo } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDoc, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { resizeAndCompressImage } from "@/lib/image";
import { cleanUndefined } from "@/lib/utils";
import { logger } from "@/utils/logger";
import { TeamEvent } from "@/types/event";
import { TeamLocation } from "../components/LocationManagerModal";

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
  uploadedBy: string;
  uploadedAt: string;
  filename: string;
  googleMediaItemId?: string;
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
  setLocations,
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

  // User Profile cache for revision logs
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userNickname, setUserNickname] = useState("");

  const editId = eventToEdit?.id || null;
  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");
  const isAdmin = !!(user && authorizedUser && (authorizedUser.role === "admin" || authorizedUser.role === "coach"));
  
  const canPublishDirectly = useMemo(() => {
    return !!(user && authorizedUser && ["admin", "coach", "mentor"].includes(authorizedUser.role));
  }, [user, authorizedUser]);

  // Fetch user profile for nickname and avatar (used in revision logging)
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      try {
        const userProfileRef = doc(db, "user_profiles", user.uid);
        const userProfileSnap = await getDoc(userProfileRef);
        if (userProfileSnap.exists()) {
          const profileData = userProfileSnap.data();
          setUserProfile(profileData);
          if (profileData.nickname) {
            setUserNickname(profileData.nickname);
          }
        }
      } catch (err) {
        logger.error("Failed to load user profile:", err);
      }
    };
    fetchProfile();
  }, [user]);

  // Sync state with eventToEdit when it changes
  useEffect(() => {
    if (isOpen) {
      if (eventToEdit) {
        setFormTitle(eventToEdit.title);
        setFormDateStart(eventToEdit.dateStart ? eventToEdit.dateStart.slice(0, 16) : "");
        setFormDateEnd(eventToEdit.dateEnd ? eventToEdit.dateEnd.slice(0, 16) : "");
        setFormLocationId(eventToEdit.locationId || "mars-building");
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
        setFormLocationId("mars-building");
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
        setPhotos(list);
      },
      (err) => {
        console.warn("Unable to fetch event photos:", err);
      }
    );
    return () => unsubscribe();
  }, [editId, isOpen]);

  // Fetch event revisions list when tab shifts
  useEffect(() => {
    if (activeTab === "revisions" && editId && isOpen) {
      fetchRevisionsList();
    }
  }, [activeTab, editId, isOpen]);

  const fetchRevisionsList = async () => {
    if (!editId) return;
    setLoadingRevisions(true);
    try {
      const q = query(collection(db, "events", editId, "revisions"), orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      const list = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as EventRevision[];
      setRevisions(list);
    } catch (err) {
      console.warn("Could not load revision logs:", err);
    } finally {
      setLoadingRevisions(false);
    }
  };

  const displayedMembers = useMemo(() => {
    const list = [...teamMembers];
    if (user && !list.some((m) => m.uid === user.uid)) {
      list.unshift({
        uid: user.uid,
        nickname: userNickname || authorizedUser?.name || user.displayName || "ARES Member",
        avatar: userProfile?.avatar || user.photoURL || `https://api.dicebear.com/9.x/bottts/svg?seed=${user.uid}`
      });
    }
    return list;
  }, [teamMembers, user, userNickname, userProfile, authorizedUser]);

  // Action: Save Event
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDateStart) return;
    if (!canEdit) return;

    const targetId = editId || `event_${Date.now()}`;
    const newEvent: TeamEvent = {
      id: targetId,
      title: formTitle.trim(),
      dateStart: formDateStart,
      dateEnd: formDateEnd || undefined,
      locationId: formLocationId || "mars-building",
      description: formDescription.trim() || undefined,
      category: formCategory,
      coverImage: formCoverImage || undefined,
      isPotluck: formIsPotluck,
      isVolunteer: formIsVolunteer,
      isDeleted: eventToEdit?.isDeleted ?? 0,
      status: canPublishDirectly ? formStatus : "pending"
    };

    try {
      await setDoc(doc(db, "events", targetId), cleanUndefined(newEvent));

      // Log audit revision if editing
      if (editId) {
        try {
          const revId = `rev_${Date.now()}`;
          const revision: EventRevision = {
            ...newEvent,
            editedBy: user?.uid || "unknown",
            editedByName: userNickname || authorizedUser?.name || "ARES Member",
            editedByAvatar:
              userProfile?.avatar ||
              user?.photoURL ||
              `https://api.dicebear.com/9.x/bottts/svg?seed=${user?.uid}`,
            timestamp: new Date().toISOString()
          } as any;
          await setDoc(doc(db, "events", editId, "revisions", revId), cleanUndefined(revision));
        } catch (revErr) {
          logger.warn("Could not log revision audit log:", revErr);
        }
      }

      onClose();
    } catch (err: any) {
      logger.error("Error saving event:", err);
      alert("Failed to save event: " + err.message);
    }
  };

  const handleDeleteEvent = async () => {
    if (!canEdit || !editId) return;
    if (!confirm("Are you sure you want to move this event to the Trash? (It will be hidden from the calendar, but visible to managers)")) return;

    try {
      const docRef = doc(db, "events", editId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const currentData = docSnap.data();
        await setDoc(docRef, cleanUndefined({
          ...currentData,
          isDeleted: 1
        }));
      }
      onClose();
    } catch (err: any) {
      logger.error("Error soft deleting event:", err);
      alert("Failed to delete event: " + err.message);
    }
  };

  const handleRestoreEvent = async () => {
    if (!canEdit || !editId) return;
    if (!confirm("Are you sure you want to restore this event to the calendar?")) return;

    try {
      const docRef = doc(db, "events", editId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const currentData = docSnap.data();
        await setDoc(docRef, cleanUndefined({
          ...currentData,
          isDeleted: 0
        }));
      }
      onClose();
    } catch (err: any) {
      logger.error("Error restoring event:", err);
      alert("Failed to restore event: " + err.message);
    }
  };

  const handlePermanentDeleteEvent = async () => {
    if (!canPublishDirectly || !editId) return;
    if (!confirm("WARNING: Are you sure you want to PERMANENTLY delete this event? This action cannot be undone and will delete all RSVPs and photos!")) return;

    try {
      await deleteDoc(doc(db, "events", editId));
      onClose();
    } catch (err: any) {
      logger.error("Error permanently deleting event:", err);
      alert("Failed to permanently delete event: " + err.message);
    }
  };

  // Action: Revert To Revision
  const handleRevertToRevision = (rev: EventRevision) => {
    setFormTitle(rev.title);
    setFormDateStart(rev.dateStart ? rev.dateStart.slice(0, 16) : "");
    setFormDateEnd(rev.dateEnd ? rev.dateEnd.slice(0, 16) : "");
    setFormLocationId(rev.locationId || "mars-building");
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
        throw new Error(errText || "Backend unified upload failed");
      }

      const data = await res.json();
      const photoId = data.photo.id || `photo_${Date.now()}`;

      const photoData: EventPhoto = {
        id: photoId,
        url: data.photo.publicUrl,
        uploadedBy: userNickname || user.displayName || "Anonymous Member",
        uploadedAt: new Date().toISOString(),
        filename: file.name,
        googleMediaItemId: data.photo.googleMediaItemId || undefined
      };

      await setDoc(doc(db, "events", editId, "photos", photoId), cleanUndefined(photoData));
      setRevertAlert("Photo uploaded to event gallery and synced to team Google Photos!");
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  // Action: Delete Photo
  const handleDeletePhoto = async (photoId: string) => {
    if (!editId || !canEdit) return;
    if (!confirm("Are you sure you want to remove this photo from the event gallery?")) return;
    try {
      await deleteDoc(doc(db, "events", editId, "photos", photoId));
      setRevertAlert("Photo removed.");
    } catch (err: any) {
      logger.error("Failed to delete photo:", err);
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
    uploadingImage,
    uploadError,
    selectedPhoto,
    setSelectedPhoto,
    isPhotoPickerOpen,
    setIsPhotoPickerOpen,
    userNickname,
    editId,
    canEdit,
    isAdmin,
    canPublishDirectly,
    displayedMembers,
    handleSaveEvent,
    handleDeleteEvent,
    handleRestoreEvent,
    handlePermanentDeleteEvent,
    handleRevertToRevision,
    handleImageUpload,
    handleDeletePhoto,
  };
}
