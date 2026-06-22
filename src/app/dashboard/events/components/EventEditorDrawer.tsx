"use client";

import React, { useEffect, useState, useMemo } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDoc, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  Trash2, 
  X, 
  Maximize2, 
  Minimize2, 
  Sparkles, 
  AlertCircle, 
  Upload, 
  RotateCcw
} from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import PhotoPickerModal from "@/components/PhotoPickerModal";
import { authenticatedFetch } from "@/lib/api";
import RevisionHistoryTable from "@/components/RevisionHistoryTable";
import { resizeAndCompressImage } from "@/lib/image";
import LocationManagerModal, { TeamLocation } from "./LocationManagerModal";
import { cleanUndefined } from "@/lib/utils";

import ShiftScheduleEditor from "./ShiftScheduleEditor";
import EventFormRoster from "./EventFormRoster";
import EventEditorAiCopilot from "./EventEditorAiCopilot";

export interface TeamEvent {
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
}

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

interface EventEditorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit: TeamEvent | null;
  locations: TeamLocation[];
  setLocations: React.Dispatch<React.SetStateAction<TeamLocation[]>>;
  teamMembers: { uid: string; nickname: string; avatar: string; }[];
}

export default function EventEditorDrawer({
  isOpen,
  onClose,
  eventToEdit,
  locations,
  setLocations,
  teamMembers
}: EventEditorDrawerProps) {
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
  const editorRef = useFocusTrap(isOpen, onClose);
  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");
  const isAdmin = !!(user && authorizedUser && authorizedUser.role === "admin");
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
        console.error("Failed to load user profile:", err);
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
  }, [isOpen, eventToEdit]);

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
          };
          await setDoc(doc(db, "events", editId, "revisions", revId), cleanUndefined(revision));
        } catch (revErr) {
          console.warn("Could not log revision audit log:", revErr);
        }
      }

      onClose();
    } catch (err: any) {
      console.error("Error saving event:", err);
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
      console.error("Error soft deleting event:", err);
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
      console.error("Error restoring event:", err);
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
      console.error("Error permanently deleting event:", err);
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
      console.error("Failed to delete photo:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer" onClick={onClose} />

      {/* Editor Drawer */}
      <div
        ref={editorRef}
        tabIndex={-1}
        className={`relative z-10 h-full bg-obsidian border-l border-white/10 flex flex-col justify-between shadow-2xl focus:outline-none transition-all duration-300 ${
          isFullScreen ? "w-full max-w-full" : "w-full max-w-5xl"
        }`}
      >
        <header className="px-6 py-4.5 border-b border-white/10 flex items-center justify-between bg-black/20 shrink-0">
          <div>
            <h3 className="text-white font-extrabold text-lg font-heading uppercase tracking-tight">
              {editId ? `Edit Event: ${formTitle}` : "Schedule Team Operation"}
            </h3>
            <p className="text-[10px] text-marble/60 uppercase font-bold mt-0.5">
              Synchronizes with public roster grids
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
              title={isFullScreen ? "Minimize Editor" : "Maximize Editor"}
            >
              {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
              aria-label="Close editor"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Sub-Header: Tabs Switcher */}
        <div className="px-6 border-b border-white/5 bg-black/10 flex justify-between items-center text-xs font-bold uppercase tracking-wider shrink-0 select-none text-left">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={`py-3 border-b-2 transition-all cursor-pointer ${
                activeTab === "edit"
                  ? "border-ares-gold text-white"
                  : "border-transparent text-marble/40 hover:text-white"
              }`}
            >
              ✏️ Edit Event
            </button>
            {editId && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab("roster")}
                  className={`py-3 border-b-2 transition-all cursor-pointer ${
                    activeTab === "roster"
                      ? "border-ares-gold text-white"
                      : "border-transparent text-marble/40 hover:text-white"
                  }`}
                >
                  👥 Roster & RSVPs
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("photos")}
                  className={`py-3 border-b-2 transition-all cursor-pointer ${
                    activeTab === "photos"
                      ? "border-ares-gold text-white"
                      : "border-transparent text-marble/40 hover:text-white"
                  }`}
                >
                  🖼️ Gallery
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("revisions")}
                  className={`py-3 border-b-2 transition-all cursor-pointer ${
                    activeTab === "revisions"
                      ? "border-ares-gold text-white"
                      : "border-transparent text-marble/40 hover:text-white"
                  }`}
                >
                  📜 Revisions
                </button>
              </>
            )}
          </div>

          {activeTab === "edit" && (
            <button
              type="button"
              onClick={() => setShowAiSidebar(!showAiSidebar)}
              className={`py-1.5 px-3 border rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-[10px] ${
                showAiSidebar
                  ? "border-ares-cyan/30 bg-ares-cyan/10 text-ares-cyan"
                  : "border-white/10 hover:border-white/25 text-marble/60 hover:text-white"
              }`}
            >
              <Sparkles size={11} />
              {showAiSidebar ? "Hide AI Copilot" : "Show AI Copilot"}
            </button>
          )}
        </div>

        {/* Revert Alert banner */}
        {revertAlert && activeTab === "edit" && (
          <div className="px-6 py-3.5 bg-ares-gold/10 border-b border-ares-gold/20 text-ares-gold text-xs font-semibold flex items-center justify-between shrink-0 text-left">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{revertAlert}</span>
            </div>
            <button
              onClick={() => setRevertAlert(null)}
              className="text-ares-gold hover:text-white cursor-pointer font-bold text-[10px] uppercase"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content canvas - changes depending on active tab */}
        <div className="flex-1 overflow-hidden bg-black/10 p-6 flex flex-col">
          {/* Tab 1: EDIT FORM */}
          {activeTab === "edit" && (
            <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0">
              <form
                onSubmit={handleSaveEvent}
                className={`space-y-6 flex-grow overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5 transition-all duration-300 ${
                  showAiSidebar ? "w-full lg:max-w-[68%]" : "w-full"
                }`}
              >
                <ShiftScheduleEditor
                  formTitle={formTitle}
                  setFormTitle={setFormTitle}
                  formDateStart={formDateStart}
                  setFormDateStart={setFormDateStart}
                  formDateEnd={formDateEnd}
                  setFormDateEnd={setFormDateEnd}
                  formLocationId={formLocationId}
                  setFormLocationId={setFormLocationId}
                  formDescription={formDescription}
                  setFormDescription={setFormDescription}
                  formCategory={formCategory}
                  setFormCategory={setFormCategory}
                  formCoverImage={formCoverImage}
                  setFormCoverImage={setFormCoverImage}
                  formIsPotluck={formIsPotluck}
                  setFormIsPotluck={setFormIsPotluck}
                  formIsVolunteer={formIsVolunteer}
                  setFormIsVolunteer={setFormIsVolunteer}
                  formStatus={formStatus}
                  setFormStatus={setFormStatus}
                  locations={locations}
                  canEdit={canEdit}
                  canPublishDirectly={canPublishDirectly}
                  setIsLocationModalOpen={setIsLocationModalOpen}
                  setIsPhotoPickerOpen={setIsPhotoPickerOpen}
                />

                <div className="pt-4 border-t border-white/5 flex justify-between gap-2 shrink-0">
                  <div className="flex gap-2">
                    {editId && canEdit && (
                      eventToEdit?.isDeleted === 1 ? (
                        <>
                          <button
                            type="button"
                            onClick={handleRestoreEvent}
                            className="px-5 py-3 border border-ares-success/35 hover:bg-ares-success/10 text-ares-success rounded text-xs uppercase font-black tracking-widest cursor-pointer transition-all flex items-center gap-2"
                          >
                            <RotateCcw size={14} />
                            Restore Event
                          </button>
                          {canPublishDirectly && (
                            <button
                              type="button"
                              onClick={handlePermanentDeleteEvent}
                              className="px-5 py-3 border border-ares-red/35 hover:bg-ares-red/10 text-ares-red-light rounded text-xs uppercase font-black tracking-widest cursor-pointer transition-all flex items-center gap-2"
                            >
                              <Trash2 size={14} />
                              Permanently Delete
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={handleDeleteEvent}
                          className="px-5 py-3 border border-ares-red/35 hover:bg-ares-red/10 text-ares-red-light rounded text-xs uppercase font-black tracking-widest cursor-pointer transition-all flex items-center gap-2"
                        >
                          <Trash2 size={14} />
                          Delete Event
                        </button>
                      )
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-3 border border-white/10 hover:bg-white/5 text-marble/70 hover:text-white rounded text-xs uppercase font-black tracking-widest cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                    {canEdit && (
                      <button
                        type="submit"
                        className="px-6 py-3 bg-ares-red text-white hover:bg-ares-red-dark font-black uppercase tracking-widest text-xs rounded transition-all shadow-md focus:ring-2 focus:ring-ares-cyan cursor-pointer"
                      >
                        {editId ? "Save Changes" : "Create Event"}
                      </button>
                    )}
                  </div>
                </div>
              </form>

              {/* SIDE AI PANEL */}
              {showAiSidebar && (
                <EventEditorAiCopilot
                  formTitle={formTitle}
                  formDescription={formDescription}
                  setFormDescription={setFormDescription}
                  formLocationId={formLocationId}
                  locations={locations}
                  setRevertAlert={setRevertAlert}
                />
              )}
            </div>
          )}

          {/* Tab 2: ROSTER & RSVPS */}
          {activeTab === "roster" && editId && (
            <EventFormRoster
              editId={editId}
              signups={signups}
              isAdmin={isAdmin}
              formIsPotluck={formIsPotluck}
              formIsVolunteer={formIsVolunteer}
              user={user}
              userNickname={userNickname}
              teamMembers={teamMembers}
              displayedMembers={displayedMembers}
              setRevertAlert={setRevertAlert}
            />
          )}

          {/* Tab 3: GALLERY */}
          {activeTab === "photos" && editId && (
            <div className="flex-grow flex flex-col justify-between overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-white/5 text-left">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-marble/60">
                    Operation Event Photo Gallery ({photos.length})
                  </h4>

                  {canEdit && (
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="px-3 py-1.5 bg-ares-gold hover:bg-ares-gold-soft text-black font-black uppercase text-[9px] tracking-wider rounded cursor-pointer transition-all inline-flex items-center gap-1">
                        <Upload size={10} />
                        {uploadingImage ? "Uploading..." : "Upload Photo"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {uploadError && (
                  <p className="text-[9px] font-mono text-ares-red bg-ares-red/10 p-2 rounded border border-ares-red/20 max-w-md">
                    {uploadError}
                  </p>
                )}

                {photos.length === 0 ? (
                  <div className="py-20 text-center text-marble/35 font-mono text-[10px] uppercase tracking-wider border border-dashed border-white/5 rounded-xl">
                    No photos uploaded yet for this operation event.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {photos.map((p) => (
                      <div
                        key={p.id}
                        className="relative group border border-white/10 rounded-lg overflow-hidden bg-black aspect-video hover:border-white/20 transition-all cursor-zoom-in"
                        onClick={() => setSelectedPhoto(p)}
                      >
                        <img src={p.url} alt="Gallery item" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between text-[8px] font-mono text-white/80 pointer-events-none">
                          <span className="truncate">{p.filename}</span>
                          <div className="flex justify-between items-center pointer-events-auto">
                            <span className="text-[7.5px] text-marble/50">By {p.uploadedBy}</span>
                            {canEdit && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePhoto(p.id);
                                }}
                                className="p-1 bg-black/80 hover:bg-ares-red/25 rounded border border-white/10 hover:border-ares-red/20 text-white cursor-pointer"
                                title="Delete photo"
                              >
                                <Trash2 size={9} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 4: REVISIONS */}
          {activeTab === "revisions" && editId && (
            <div className="flex-grow overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-white/5 text-left">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-marble/60">
                Revision Audit History ({revisions.length})
              </h4>
              <RevisionHistoryTable
                revisions={revisions}
                isLoading={loadingRevisions}
                onRevert={handleRevertToRevision}
              />
            </div>
          )}
        </div>
      </div>

      {/* Lightbox / Selected Photo Modal overlay */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center p-4">
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-full transition-colors cursor-pointer"
            aria-label="Close Lightbox"
          >
            <X size={18} />
          </button>
          <div className="max-w-4xl max-h-[85vh] flex flex-col gap-3">
            <img
              src={selectedPhoto.url}
              alt="Enlarged gallery item"
              className="max-h-[80vh] w-auto object-contain rounded-lg border border-white/5 shadow-2xl"
            />
            <div className="flex justify-between items-center text-[9px] font-mono text-marble/55 uppercase">
              <span>{selectedPhoto.filename}</span>
              <span>
                By {selectedPhoto.uploadedBy} ● {new Date(selectedPhoto.uploadedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Google Photo Picker Modal overlay */}
      <PhotoPickerModal
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onSelect={(url) => setFormCoverImage(url)}
      />

      {/* Locations Manager Modal overlay */}
      <LocationManagerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        locations={locations}
        setLocations={setLocations}
        formLocationId={formLocationId}
        setFormLocationId={setFormLocationId}
      />
    </div>
  );
}
