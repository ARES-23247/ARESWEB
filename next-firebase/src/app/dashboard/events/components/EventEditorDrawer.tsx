"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDoc, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  Plus, 
  Trash2, 
  Pencil, 
  Shield, 
  MapPin, 
  X, 
  Maximize2, 
  Minimize2, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Circle, 
  Upload, 
  Users, 
  Image as ImageIcon 
} from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import MarkdownEditor from "@/components/MarkdownEditor";
import PhotoPickerModal from "@/components/PhotoPickerModal";
import { authenticatedFetch } from "@/lib/api";
import RevisionHistoryTable from "@/components/RevisionHistoryTable";
import { resizeAndCompressImage } from "@/lib/image";
import { TeamLocation } from "./LocationManagerModal";

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
  teamMembers: { uid: string; nickname: string; avatar: string; }[];
}

export default function EventEditorDrawer({
  isOpen,
  onClose,
  eventToEdit,
  locations,
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

  // Modal display states
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "roster" | "photos" | "revisions">("edit");
  const [showAiSidebar, setShowAiSidebar] = useState(false);
  const [revertAlert, setRevertAlert] = useState<string | null>(null);

  // RSVP, Photos, Revisions list states
  const [signups, setSignups] = useState<EventSignup[]>([]);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [revisions, setRevisions] = useState<EventRevision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  // RSVP Form states
  const [bringing, setBringing] = useState("");
  const [notes, setNotes] = useState("");
  const [prepHours, setPrepHours] = useState(0);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [submittingRsvp, setSubmittingRsvp] = useState(false);

  // Photo uploading states
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<EventPhoto | null>(null);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [selectedMemberIdToCheckin, setSelectedMemberIdToCheckin] = useState("");

  // AI states
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [grammarEdits, setGrammarEdits] = useState<any[]>([]);
  const [suggestedCorrection, setSuggestedCorrection] = useState("");

  // User Profile cache for revision logs
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userNickname, setUserNickname] = useState("");

  const editId = eventToEdit?.id || null;
  const editorRef = useFocusTrap(isOpen, onClose);
  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");
  const isAdmin = !!(user && authorizedUser && authorizedUser.role === "admin");

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
      }

      // Reset modal UI states
      setIsFullScreen(false);
      setActiveTab("edit");
      setShowAiSidebar(false);
      setRevertAlert(null);
      setGrammarEdits([]);
      setAiResponse("");
      setSignups([]);
      setPhotos([]);
      setRevisions([]);
      setBringing("");
      setNotes("");
      setPrepHours(0);
      setSignupError(null);
      setSelectedMemberIdToCheckin("");
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

  // Find if current user is signed up for active event
  const mySignup = useMemo(() => {
    if (!user) return null;
    return signups.find((s) => s.userId === user.uid) || null;
  }, [signups, user]);

  // Prefill active RSVP details
  useEffect(() => {
    if (mySignup) {
      setBringing(mySignup.bringing || "");
      setNotes(mySignup.notes || "");
      setPrepHours(mySignup.prepHours || 0);
    } else {
      setBringing("");
      setNotes("");
      setPrepHours(0);
    }
  }, [mySignup]);

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
      isVolunteer: formIsVolunteer
    };

    try {
      await setDoc(doc(db, "events", targetId), newEvent);

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
          await setDoc(doc(db, "events", editId, "revisions", revId), revision);
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

  // Action: Submit self-RSVP
  const handleRsvpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editId) return;
    setSubmittingRsvp(true);
    setSignupError(null);
    try {
      const signupData: EventSignup = {
        userId: user.uid,
        nickname: userNickname || user.displayName || "Anonymous Member",
        bringing: formIsPotluck === 1 ? bringing.trim() : undefined,
        prepHours: formIsVolunteer === 1 ? prepHours : undefined,
        notes: notes.trim() || undefined,
        attended: mySignup?.attended || false
      };
      await setDoc(doc(db, "events", editId, "signups", user.uid), signupData);
      setRevertAlert("RSVP updated successfully!");
    } catch (err: any) {
      setSignupError(err.message || "Failed to save RSVP.");
    } finally {
      setSubmittingRsvp(false);
    }
  };

  // Action: Cancel self-RSVP
  const handleRsvpCancel = async () => {
    if (!user || !editId) return;
    setSubmittingRsvp(true);
    setSignupError(null);
    try {
      await deleteDoc(doc(db, "events", editId, "signups", user.uid));
      setBringing("");
      setNotes("");
      setPrepHours(0);
      setRevertAlert("RSVP cancelled.");
    } catch (err: any) {
      setSignupError(err.message || "Failed to cancel RSVP.");
    } finally {
      setSubmittingRsvp(false);
    }
  };

  // Action: Quick Admin Check-in of another member
  const handleQuickCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId || !selectedMemberIdToCheckin || !isAdmin) return;
    try {
      const member = teamMembers.find((m) => m.uid === selectedMemberIdToCheckin);
      if (!member) return;

      const checkinData: EventSignup = {
        userId: member.uid,
        nickname: member.nickname,
        notes: "Admin Checked In",
        attended: true
      };
      await setDoc(doc(db, "events", editId, "signups", member.uid), checkinData, { merge: true });
      setSelectedMemberIdToCheckin("");
      setRevertAlert(`Successfully checked in ${member.nickname}`);
    } catch (err: any) {
      console.error("Failed admin check-in:", err);
    }
  };

  // Action: Toggle Attendance check-in status (Admin only)
  const handleToggleAttendance = async (signupId: string, currentAttendedStatus: boolean) => {
    if (!editId || !isAdmin) return;
    try {
      await setDoc(
        doc(db, "events", editId, "signups", signupId),
        { attended: !currentAttendedStatus },
        { merge: true }
      );
    } catch (err: any) {
      console.error("Failed to toggle attendance:", err);
    }
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

      await setDoc(doc(db, "events", editId, "photos", photoId), photoData);
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

  // AI Copilot: Assistant prompt
  const handleAiAssistant = async (prompt: string, presetName = "") => {
    if (!prompt.trim()) return;
    setAiLoading(true);
    setAiResponse("");
    try {
      const res = await authenticatedFetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: presetName ? `${presetName}: ${prompt}` : prompt,
          text: formDescription,
          context: `Event Title: ${formTitle}\nLocation: ${
            locations.find((l) => l.id === formLocationId)?.name || "MARS Building"
          }`
        })
      });

      if (!res.ok) throw new Error("AI Assistant service error.");
      const data = await res.json();
      setAiResponse(data.response || "");
    } catch (err: any) {
      setAiResponse(
        `Failed to contact Gemini co-pilot: ${err.message}. Using offline fallback.\n\nOur team is committed to implementing robust code structures inside FIRST® programs. By using ARESLib, we maintain clean state machines and accurate sensor integrations.`
      );
    } finally {
      setAiLoading(false);
    }
  };

  // AI Copilot: Grammar check
  const handleGrammarCheck = async () => {
    if (!formDescription.trim()) return;
    setAiLoading(true);
    setGrammarEdits([]);
    setSuggestedCorrection("");
    try {
      const res = await authenticatedFetch("/api/ai/grammar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: formDescription })
      });

      if (!res.ok) throw new Error("AI Grammar check service error.");
      const data = await res.json();
      setSuggestedCorrection(data.correctedText || "");
      setGrammarEdits(data.edits || []);
    } catch (err: any) {
      console.warn(err);
      setSuggestedCorrection(formDescription);
      setGrammarEdits([
        {
          original: "offline check",
          corrected: "online check",
          explanation: "Connect to live sync to get full Gemini spelling check."
        }
      ]);
    } finally {
      setAiLoading(false);
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
        <div className="px-6 border-b border-white/5 bg-black/10 flex justify-between items-center text-xs font-bold uppercase tracking-wider shrink-0 select-none">
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
              <Sparkles size={11} className={aiLoading ? "animate-spin" : ""} />
              {showAiSidebar ? "Hide AI Copilot" : "Show AI Copilot"}
            </button>
          )}
        </div>

        {/* Revert Alert banner */}
        {revertAlert && activeTab === "edit" && (
          <div className="px-6 py-3.5 bg-ares-gold/10 border-b border-ares-gold/20 text-ares-gold text-xs font-semibold flex items-center justify-between shrink-0">
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
                <div className="space-y-6">
                  <div>
                    <label
                      htmlFor="event-title"
                      className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                    >
                      Event Title
                    </label>
                    <input
                      id="event-title"
                      type="text"
                      placeholder="e.g. Sunday Night EKF Odometry Calibrations"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="event-start"
                        className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                      >
                        Start Date & Time
                      </label>
                      <input
                        id="event-start"
                        type="datetime-local"
                        value={formDateStart}
                        onChange={(e) => setFormDateStart(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 text-marble/95 text-xs rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer focus:ring-2 focus:ring-ares-cyan"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="event-end"
                        className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                      >
                        End Date & Time (Optional)
                      </label>
                      <input
                        id="event-end"
                        type="datetime-local"
                        value={formDateEnd}
                        onChange={(e) => setFormDateEnd(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 text-marble/95 text-xs rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer focus:ring-2 focus:ring-ares-cyan"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    {/* Location selector */}
                    <div className="space-y-2">
                      <label
                        htmlFor="event-location-select"
                        className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                      >
                        Location / Venue
                      </label>
                      <select
                        id="event-location-select"
                        value={formLocationId || "mars-building"}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormLocationId(val);
                        }}
                        className="w-full bg-black/60 border border-white/10 text-xs text-white rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer focus:ring-2 focus:ring-ares-cyan"
                      >
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id} className="bg-neutral-900 text-white">
                            {loc.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-marble/45 font-medium leading-relaxed">
                        Need a new location? Configure options directly using the map builder layouts.
                      </p>
                    </div>

                    {/* Location Preview Card */}
                    {formLocationId !== "" && (
                      <div className="p-4 bg-white/5 border border-white/5 rounded-lg flex flex-col justify-between min-h-[100px] hover:border-white/10 transition-colors">
                        {(() => {
                          const selected = locations.find((l) => l.id === formLocationId);
                          if (!selected) return <p className="text-[10px] text-marble/40">MARS Building Default</p>;
                          return (
                            <>
                              <div>
                                <h4 className="text-xs font-bold text-white uppercase tracking-tight flex items-center gap-1.5">
                                  <MapPin size={12} className="text-ares-gold" />
                                  {selected.name}
                                </h4>
                                <p className="text-[10px] text-marble/65 mt-1 font-mono">{selected.address}</p>
                                {selected.description && (
                                  <p className="text-[9px] text-marble/45 mt-2 leading-relaxed italic">
                                    {selected.description}
                                  </p>
                                )}
                              </div>
                              {selected.gmapsUrl && (
                                <a
                                  href={selected.gmapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[9px] text-ares-cyan hover:underline font-bold uppercase tracking-widest mt-3 block"
                                >
                                  Open Google Directions ↗
                                </a>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">
                      Cover Image (Optional)
                    </label>
                    <div className="flex gap-3 items-center">
                      <input
                        type="url"
                        placeholder="Paste image link, or pick from gallery..."
                        value={formCoverImage}
                        onChange={(e) => setFormCoverImage(e.target.value)}
                        className="flex-grow bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
                      />
                      <button
                        type="button"
                        onClick={() => setIsPhotoPickerOpen(true)}
                        className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-marble/90 hover:text-white text-[10px] uppercase font-black tracking-widest rounded transition-all cursor-pointer flex items-center gap-1.5 focus:ring-2 focus:ring-ares-cyan focus:outline-none shrink-0"
                      >
                        <ImageIcon size={12} /> Gallery
                      </button>
                    </div>
                    {formCoverImage && (
                      <div className="mt-3 relative w-48 h-28 border border-white/10 rounded-lg overflow-hidden group">
                        <img src={formCoverImage} alt="Cover preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormCoverImage("")}
                          className="absolute top-1.5 right-1.5 p-1 bg-black/80 hover:bg-black border border-white/10 text-white rounded-full transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">
                        Event Category
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormCategory("internal")}
                          className={`flex-1 py-2 rounded text-xs uppercase font-bold tracking-wider transition-all border cursor-pointer ${
                            formCategory === "internal"
                              ? "bg-ares-red/15 border-ares-red text-white font-black"
                              : "bg-transparent border-white/10 text-marble/50 hover:text-white"
                          }`}
                        >
                          Internal Practice
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormCategory("outreach")}
                          className={`flex-1 py-2 rounded text-xs uppercase font-bold tracking-wider transition-all border cursor-pointer ${
                            formCategory === "outreach"
                              ? "bg-ares-gold/15 border-ares-gold text-ares-gold font-black"
                              : "bg-transparent border-white/10 text-marble/50 hover:text-white"
                          }`}
                        >
                          Outreach & STEM
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">
                          Potluck
                        </span>
                        <div className="flex gap-1 bg-black/20 p-1 border border-white/5 rounded">
                          <button
                            type="button"
                            onClick={() => setFormIsPotluck(0)}
                            className={`flex-1 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
                              formIsPotluck === 0 ? "bg-white/10 text-white" : "text-marble/40"
                            }`}
                          >
                            No
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormIsPotluck(1)}
                            className={`flex-1 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
                              formIsPotluck === 1 ? "bg-ares-gold/20 text-ares-gold font-black" : "text-marble/40"
                            }`}
                          >
                            Yes
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">
                          Volunteer Ops
                        </span>
                        <div className="flex gap-1 bg-black/20 p-1 border border-white/5 rounded">
                          <button
                            type="button"
                            onClick={() => setFormIsVolunteer(0)}
                            className={`flex-1 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
                              formIsVolunteer === 0 ? "bg-white/10 text-white" : "text-marble/40"
                            }`}
                          >
                            No
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormIsVolunteer(1)}
                            className={`flex-1 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
                              formIsVolunteer === 1 ? "bg-ares-cyan/20 text-ares-cyan font-black" : "text-marble/40"
                            }`}
                          >
                            Yes
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="event-desc-editor"
                      className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                    >
                      Description & Logistical Details (Markdown supported)
                    </label>
                    <MarkdownEditor
                      value={formDescription}
                      onChange={setFormDescription}
                      placeholder="e.g. Schedule for driver trials. Bringing snacks: yes. Intaking linear rail repairs first."
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex justify-end gap-2 shrink-0">
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
              </form>

              {/* SIDE AI PANEL */}
              {showAiSidebar && (
                <div className="w-full lg:w-[32%] border-l border-white/10 p-5 bg-black/35 rounded-xl flex flex-col justify-between overflow-y-auto shrink-0 space-y-5 scrollbar-thin scrollbar-thumb-white/5">
                  <div className="space-y-5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={16} className="text-ares-cyan" />
                      <h4 className="text-xs font-black uppercase tracking-widest text-white">Gemini Operation Copilot</h4>
                    </div>

                    <div className="space-y-2.5">
                      <span className="text-[9px] uppercase font-black tracking-widest text-marble/45 block">
                        Quick Assistant Presets
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleAiAssistant(
                              "Write a catchy announcement for our team newsletter introducing this event.",
                              "Outreach Copywriter"
                            )
                          }
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-[8px] uppercase tracking-wider text-marble/80 hover:text-white transition-all cursor-pointer"
                        >
                          Newsletter Pitch
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleAiAssistant(
                              "Suggest a list of safety guidelines and materials needed for this event.",
                              "Mechanical Safety"
                            )
                          }
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-[8px] uppercase tracking-wider text-marble/80 hover:text-white transition-all cursor-pointer"
                        >
                          Safety Checklist
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleAiAssistant(
                              "Refactor this explanation to be highly professional and engaging for FLL team parents.",
                              "Youth Coordinator"
                            )
                          }
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-[8px] uppercase tracking-wider text-marble/80 hover:text-white transition-all cursor-pointer"
                        >
                          Parent Friendly
                        </button>
                      </div>
                    </div>

                    {/* Chat Prompt */}
                    <div className="space-y-2">
                      <label
                        htmlFor="ai-chat-prompt"
                        className="block text-[8px] uppercase font-black tracking-widest text-marble/45"
                      >
                        Ask Custom Task
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="ai-chat-prompt"
                          type="text"
                          placeholder="e.g. List potluck snack ideas..."
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          className="flex-grow bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-cyan"
                        />
                        <button
                          type="button"
                          onClick={() => handleAiAssistant(aiPrompt)}
                          disabled={aiLoading}
                          className="px-3.5 bg-ares-cyan text-black rounded-lg hover:brightness-110 font-black uppercase text-[10px] tracking-wider transition-all disabled:opacity-40 cursor-pointer shrink-0"
                        >
                          Ask
                        </button>
                      </div>
                    </div>

                    {/* AI Response Output */}
                    {aiResponse && (
                      <div className="space-y-1.5 animate-fade-in">
                        <span className="text-[8px] uppercase font-black tracking-widest text-ares-cyan block">
                          Copilot Output
                        </span>
                        <div className="p-3 bg-black/45 border border-ares-cyan/10 rounded-lg text-xs leading-relaxed text-marble/90 font-medium font-mono max-h-[160px] overflow-y-auto scrollbar-thin whitespace-pre-wrap select-text">
                          {aiResponse}
                        </div>
                      </div>
                    )}

                    {/* Grammar checker */}
                    <div className="border-t border-white/5 pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                          Description Grammar & Style
                        </span>
                        <button
                          type="button"
                          onClick={handleGrammarCheck}
                          disabled={aiLoading}
                          className="px-2.5 py-1 border border-ares-cyan/35 hover:bg-ares-cyan/15 text-ares-cyan text-[8px] uppercase font-black tracking-widest rounded transition-all cursor-pointer"
                        >
                          Run Spelling Audit
                        </button>
                      </div>

                      {suggestedCorrection && (
                        <div className="space-y-2 animate-fade-in">
                          <p className="text-[9px] text-marble/40">Suggested edit:</p>
                          <div className="p-2.5 bg-white/5 rounded border border-white/5 text-[11px] leading-relaxed text-white whitespace-pre-wrap">
                            {suggestedCorrection}
                          </div>
                          {grammarEdits.length > 0 && (
                            <div className="space-y-1.5">
                              {grammarEdits.map((ed, idx) => (
                                <div key={idx} className="p-2 bg-ares-red/10 border border-ares-red/25 rounded text-[9px] text-marble/85 font-mono">
                                  <span className="text-ares-red line-through block">-{ed.original}</span>
                                  <span className="text-ares-success font-bold block">+{ed.corrected}</span>
                                  {ed.explanation && <p className="text-[8px] text-marble/45 mt-1 italic">{ed.explanation}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setFormDescription(suggestedCorrection);
                              setSuggestedCorrection("");
                              setGrammarEdits([]);
                            }}
                            className="w-full py-1.5 bg-ares-cyan text-black font-black uppercase tracking-widest text-[9px] rounded hover:brightness-105 transition-all cursor-pointer shadow-md"
                          >
                            Apply Corrections
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-[8.5px] font-mono text-marble/35 uppercase leading-normal tracking-wide mt-5">
                    Powered by Google Gemini 1.5 Pro. Logs auto-reconciled with ARESLib rules.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: ROSTER & RSVPS */}
          {activeTab === "roster" && editId && (
            <div className="flex-grow flex flex-col md:flex-row gap-6 overflow-hidden min-h-0">
              {/* Roster list */}
              <div className="flex-1 bg-black/20 border border-white/5 rounded-xl p-5 overflow-y-auto flex flex-col justify-between scrollbar-thin scrollbar-thumb-white/5">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-marble/60">
                    Operation Attendance Roster ({signups.length})
                  </h4>

                  {signups.length === 0 ? (
                    <div className="py-12 text-center text-marble/35 font-mono text-[10px] uppercase tracking-wider">
                      Roster is currently empty.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {signups.map((su) => (
                        <div
                          key={su.userId}
                          className="p-3 bg-white/5 border border-white/5 rounded-lg flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              onClick={() => {
                                if (isAdmin) handleToggleAttendance(su.userId, !!su.attended);
                              }}
                              className={`cursor-pointer transition-colors p-1 rounded-full ${
                                su.attended
                                  ? "text-ares-success hover:text-ares-success/75"
                                  : "text-marble/35 hover:text-white"
                              }`}
                              title={isAdmin ? "Toggle Attendance status" : "RSVP Status"}
                            >
                              {su.attended ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white uppercase tracking-tight">
                                {su.nickname}
                              </p>
                              {su.notes && (
                                <p className="text-[9px] text-marble/45 italic leading-normal">
                                  Notes: {su.notes}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-1 text-[8.5px] font-mono text-marble/40 uppercase">
                                {su.bringing && (
                                  <span className="text-ares-gold">🥪 Bringing: {su.bringing}</span>
                                )}
                                {su.prepHours !== undefined && (
                                  <span className="text-ares-cyan">⚙️ Prep: {su.prepHours} hrs</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteRsvp(su.userId)}
                              className="p-1.5 bg-white/5 hover:bg-ares-red/25 border border-white/10 text-marble/55 hover:text-white rounded transition-all cursor-pointer"
                              title="Remove RSVP"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Check-in Form for Admin */}
                {isAdmin && (
                  <form onSubmit={handleQuickCheckin} className="border-t border-white/5 pt-4 mt-6 space-y-3">
                    <span className="text-[9px] uppercase font-black tracking-widest text-ares-gold block">
                      Quick Admin Check-in
                    </span>
                    <div className="flex gap-2">
                      <select
                        value={selectedMemberIdToCheckin}
                        onChange={(e) => setSelectedMemberIdToCheckin(e.target.value)}
                        className="flex-grow bg-black/60 border border-white/10 text-xs text-white rounded px-3 py-2 focus:outline-none cursor-pointer"
                      >
                        <option value="">Select Team Member...</option>
                        {displayedMembers.map((m) => (
                          <option key={m.uid} value={m.uid}>
                            {m.nickname}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-ares-gold text-black hover:bg-ares-gold-soft rounded text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all"
                      >
                        Check In
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Self RSVP Card */}
              {user && (
                <div className="w-full md:w-80 p-5 bg-white/5 border border-white/10 rounded-xl flex flex-col justify-between shrink-0 space-y-4">
                  <form onSubmit={handleRsvpSubmit} className="space-y-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-marble/60">
                      Submit Your Operation RSVP
                    </h4>

                    {signupError && (
                      <p className="text-[9px] font-mono text-ares-red bg-ares-red/10 p-2 rounded border border-ares-red/20">
                        {signupError}
                      </p>
                    )}

                    {formIsPotluck === 1 && (
                      <div>
                        <label
                          htmlFor="rsvp-bringing"
                          className="block text-[8px] uppercase font-black tracking-widest text-marble/45 mb-1"
                        >
                          🥪 What will you bring? (Optional)
                        </label>
                        <input
                          id="rsvp-bringing"
                          type="text"
                          placeholder="e.g. Case of soda, cookies..."
                          value={bringing}
                          onChange={(e) => setBringing(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-gold"
                        />
                      </div>
                    )}

                    {formIsVolunteer === 1 && (
                      <div>
                        <label
                          htmlFor="rsvp-prep-hours"
                          className="block text-[8px] uppercase font-black tracking-widest text-marble/45 mb-1"
                        >
                          ⚙️ Anticipated Prep Work Hours
                        </label>
                        <input
                          id="rsvp-prep-hours"
                          type="number"
                          min="0"
                          max="24"
                          value={prepHours}
                          onChange={(e) => setPrepHours(parseInt(e.target.value) || 0)}
                          className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-cyan"
                        />
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="rsvp-notes"
                        className="block text-[8px] uppercase font-black tracking-widest text-marble/45 mb-1"
                      >
                        📝 RSVP Notes (Optional)
                      </label>
                      <textarea
                        id="rsvp-notes"
                        placeholder="e.g. Arriving 15 mins late. Running odometry code checks."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full h-16 bg-black/60 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-ares-cyan resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingRsvp}
                      className="w-full py-2 bg-ares-cyan text-black hover:brightness-105 font-black uppercase text-[10px] tracking-widest rounded-lg transition-all disabled:opacity-40 cursor-pointer shadow-md"
                    >
                      {submittingRsvp ? "Updating..." : mySignup ? "Update RSVP" : "Confirm RSVP (Will Attend)"}
                    </button>
                  </form>

                  {mySignup && (
                    <button
                      type="button"
                      onClick={handleRsvpCancel}
                      disabled={submittingRsvp}
                      className="w-full py-2 bg-white/5 border border-white/5 hover:bg-ares-red/15 text-marble/55 hover:text-white text-[9px] uppercase font-black tracking-widest rounded-lg transition-all cursor-pointer"
                    >
                      Cancel Attendance
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: GALLERY */}
          {activeTab === "photos" && editId && (
            <div className="flex-grow flex flex-col justify-between overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-white/5">
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
                loading={loadingRevisions}
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
    </div>
  );
}
