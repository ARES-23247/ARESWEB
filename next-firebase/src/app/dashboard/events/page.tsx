"use client";

import React, { useEffect, useState, useMemo } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDoc, getDocs, addDoc, query, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  Plus, 
  Trash2, 
  Pencil, 
  Shield, 
  Activity, 
  MapPin, 
  Calendar, 
  Clock, 
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

interface TeamEvent {
  id: string;
  title: string;
  dateStart: string;
  dateEnd?: string;
  location?: string;
  description?: string;
  category: "internal" | "outreach";
  coverImage?: string;
  isPotluck?: number;
  isVolunteer?: number;
}

interface EventRevision {
  id: string;
  title: string;
  dateStart: string;
  dateEnd?: string;
  location?: string;
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

interface EventSignup {
  userId: string;
  nickname: string;
  bringing?: string;
  notes?: string;
  prepHours?: number;
  attended?: boolean;
}

interface EventPhoto {
  id: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
  filename: string;
}

export default function EventsManagementPage() {
  const { user, authorizedUser } = useAuth();
  const [events, setEvents] = useState<TeamEvent[]>(MOCK_EVENTS);
  const [isLive, setIsLive] = useState(false);

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDateStart, setFormDateStart] = useState("");
  const [formDateEnd, setFormDateEnd] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<"internal" | "outreach">("internal");
  const [formCoverImage, setFormCoverImage] = useState("");
  const [formIsPotluck, setFormIsPotluck] = useState<number>(0);
  const [formIsVolunteer, setFormIsVolunteer] = useState<number>(0);
  
  // New upgraded modal states
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "roster" | "photos" | "revisions">("edit");
  const [showAiSidebar, setShowAiSidebar] = useState(false);
  const [revertAlert, setRevertAlert] = useState<string | null>(null);

  // Roster, Profile, and Signups / Photos states
  const [teamMembers, setTeamMembers] = useState<{ uid: string; nickname: string; avatar: string; }[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userNickname, setUserNickname] = useState("");
  const [signups, setSignups] = useState<EventSignup[]>([]);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [revisions, setRevisions] = useState<EventRevision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  // RSVP Form state
  const [bringing, setBringing] = useState("");
  const [notes, setNotes] = useState("");
  const [prepHours, setPrepHours] = useState(0);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [submittingRsvp, setSubmittingRsvp] = useState(false);

  // Photo uploads & Lightbox state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<EventPhoto | null>(null);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [selectedMemberIdToCheckin, setSelectedMemberIdToCheckin] = useState("");

  // AI Copilot States
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [grammarEdits, setGrammarEdits] = useState<any[]>([]);
  const [suggestedCorrection, setSuggestedCorrection] = useState("");

  const editorRef = useFocusTrap(isEditorOpen, () => setIsEditorOpen(false));
  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");
  const isAdmin = !!(user && authorizedUser && authorizedUser.role === "admin");

  // Fetch team roster for quick check-ins
  useEffect(() => {
    const fetchRoster = async () => {
      try {
        const res = await authenticatedFetch("/api/profiles/team-roster");
        if (res.ok) {
          const data = await res.json();
          setTeamMembers(data.members || []);
        }
      } catch (err) {
        console.error("Failed to load team roster:", err);
      }
    };
    fetchRoster();
  }, []);

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
        console.warn("Could not retrieve user profile:", err);
      }
    };
    fetchProfile();
  }, [user]);

  // Fetch active event signups list in real-time
  useEffect(() => {
    if (!editId) return;
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
  }, [editId]);

  // Fetch active event photos in real-time
  useEffect(() => {
    if (!editId) return;
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
  }, [editId]);

  // Fetch event revisions list when tab shifts
  useEffect(() => {
    if (activeTab === "revisions" && editId) {
      fetchRevisionsList();
    }
  }, [activeTab, editId]);

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

  // 1. Listen for real-time calendar event updates
  useEffect(() => {
    try {
      const eventsRef = collection(db, "events");
      const unsubscribe = onSnapshot(
        eventsRef,
        (snapshot) => {
          if (snapshot.empty) {
            setEvents(MOCK_EVENTS);
            setIsLive(false);
            return;
          }
          const list = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              title: data.title || "Untitled Event",
              dateStart: data.dateStart || "",
              dateEnd: data.dateEnd || "",
              location: data.location || "",
              description: data.description || "",
              category: data.category || "internal",
              coverImage: data.coverImage || "",
              isPotluck: data.isPotluck || 0,
              isVolunteer: data.isVolunteer || 0
            } as TeamEvent;
          });
          
          // Sort events by dateStart ASC
          list.sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime());
          setEvents(list);
          setIsLive(true);
        },
        (err) => {
          console.warn("Firestore not connected, using fallback mock events.", err.message);
          setEvents(MOCK_EVENTS);
          setIsLive(false);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn("Local sandbox mode, using static mock schedule.", e);
      setEvents(MOCK_EVENTS);
      setIsLive(false);
    }
  }, []);

  // Open editor for creating
  const handleOpenCreate = () => {
    setEditId(null);
    setFormTitle("");
    setFormDateStart(new Date().toISOString().slice(0, 16));
    setFormDateEnd(new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16)); // Default 2 hrs later
    setFormLocation("MARS Laboratory");
    setFormDescription("");
    setFormCategory("internal");
    setFormCoverImage("");
    setFormIsPotluck(0);
    setFormIsVolunteer(0);

    // Reset modal and additional states
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
    
    setIsEditorOpen(true);
  };

  // Open editor for editing
  const handleOpenEdit = (evt: TeamEvent) => {
    setEditId(evt.id);
    setFormTitle(evt.title);
    setFormDateStart(evt.dateStart ? evt.dateStart.slice(0, 16) : "");
    setFormDateEnd(evt.dateEnd ? evt.dateEnd.slice(0, 16) : "");
    setFormLocation(evt.location || "");
    setFormDescription(evt.description || "");
    setFormCategory(evt.category);
    setFormCoverImage(evt.coverImage || "");
    setFormIsPotluck(evt.isPotluck || 0);
    setFormIsVolunteer(evt.isVolunteer || 0);

    // Reset modal and additional states
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
    
    setIsEditorOpen(true);
  };

  // 2. Action: Save Event
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
      location: formLocation.trim() || undefined,
      description: formDescription.trim() || undefined,
      category: formCategory,
      coverImage: formCoverImage || undefined,
      isPotluck: formIsPotluck,
      isVolunteer: formIsVolunteer
    };

    try {
      await setDoc(doc(db, "events", targetId), newEvent);
      
      // Save Revision Document
      if (user) {
        const revId = `rev_${Date.now()}`;
        const revisionData: EventRevision = {
          id: revId,
          title: formTitle.trim(),
          dateStart: formDateStart,
          dateEnd: formDateEnd || undefined,
          location: formLocation.trim() || undefined,
          description: formDescription.trim() || undefined,
          category: formCategory,
          coverImage: formCoverImage || undefined,
          isPotluck: formIsPotluck,
          isVolunteer: formIsVolunteer,
          editedBy: user.uid,
          editedByName: userNickname || user.displayName || "Anonymous Member",
          editedByAvatar: userProfile?.avatar || user.photoURL || `https://api.dicebear.com/9.x/bottts/svg?seed=${user.uid}`,
          timestamp: new Date().toISOString()
        };
        await setDoc(doc(db, "events", targetId, "revisions", revId), revisionData);
      }
      
      setIsEditorOpen(false);
    } catch (err) {
      console.warn("Unable to save event online, updating local array.", err);
      if (editId) {
        setEvents(events.map(ev => ev.id === editId ? newEvent : ev));
      } else {
        setEvents([...events, newEvent].sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()));
      }
      setIsEditorOpen(false);
    }
  };

  // 3. Action: Delete Event
  const handleDeleteEvent = async (id: string) => {
    if (!canEdit) return;
    if (!confirm("Are you sure you want to delete this event from the calendar?")) return;

    try {
      await deleteDoc(doc(db, "events", id));
    } catch (err) {
      console.warn("Firestore offline, deleting event locally.", err);
      setEvents(events.filter(ev => ev.id !== id));
    }
  };

  // 4. Action: Revert To Revision
  const handleRevertToRevision = (rev: EventRevision) => {
    setFormTitle(rev.title);
    setFormDateStart(rev.dateStart ? rev.dateStart.slice(0, 16) : "");
    setFormDateEnd(rev.dateEnd ? rev.dateEnd.slice(0, 16) : "");
    setFormLocation(rev.location || "");
    setFormDescription(rev.description || "");
    setFormCategory(rev.category);
    setFormCoverImage(rev.coverImage || "");
    setFormIsPotluck(rev.isPotluck || 0);
    setFormIsVolunteer(rev.isVolunteer || 0);
    setRevertAlert(`Reverted unsaved draft to revision from ${new Date(rev.timestamp).toLocaleString()}. Save event to commit changes.`);
    setActiveTab("edit");
  };

  // 5. Action: Submit self-RSVP
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

  // 6. Action: Cancel self-RSVP
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

  // 7. Action: Quick Admin Check-in of another member
  const handleQuickCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId || !selectedMemberIdToCheckin || !isAdmin) return;
    try {
      const member = teamMembers.find(m => m.uid === selectedMemberIdToCheckin);
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

  // 8. Action: Toggle Attendance check-in status (Admin only)
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

  // 9. Action: Upload Photo
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editId || !user) return;
    setUploadingImage(true);
    setUploadError(null);
    try {
      const photoId = `photo_${Date.now()}`;
      const storageRef = ref(storage, `events/${editId}/photos/${photoId}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      
      const photoData: EventPhoto = {
        id: photoId,
        url: downloadUrl,
        uploadedBy: userNickname || user.displayName || "Anonymous Member",
        uploadedAt: new Date().toISOString(),
        filename: file.name
      };
      await setDoc(doc(db, "events", editId, "photos", photoId), photoData);
      setRevertAlert("Photo uploaded successfully!");
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  // 10. Action: Delete Photo
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

  // 11. AI Copilot: Assistant prompt
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
          context: `Event Title: ${formTitle}\nLocation: ${formLocation}`
        })
      });

      if (!res.ok) throw new Error("AI Assistant service error.");
      const data = await res.json();
      setAiResponse(data.response || "");
    } catch (err: any) {
      setAiResponse(`Failed to contact Gemini co-pilot: ${err.message}. Using offline fallback.\n\nOur team is committed to implementing robust code structures inside FIRST® programs. By using ARESLib, we maintain clean state machines and accurate sensor integrations.`);
    } finally {
      setAiLoading(false);
    }
  };

  // 12. AI Copilot: Grammar check
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
      setGrammarEdits([{ original: "offline check", corrected: "online check", explanation: "Connect to live sync to get full Gemini spelling check." }]);
    } finally {
      setAiLoading(false);
    }
  };

  // Ensure the logged-in user is always present in the displayed checklist
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

  return (
    <div className="space-y-10 w-full text-left">
      
      {/* Header */}
      <header className="border-b border-white/5 pb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
            <Activity size={12} className="animate-pulse" /> Operational Timelines
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading flex flex-wrap items-center gap-3">
            Manage Events
            {isLive ? (
              <span className="inline-flex items-center rounded-full bg-ares-success/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ares-success ring-1 ring-inset ring-ares-success/30 ml-2">
                ● Live Sync
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-ares-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ares-gold ring-1 ring-inset ring-ares-gold/30 ml-2">
                ● Sandbox
              </span>
            )}
          </h1>
          <p className="text-marble/70 text-sm mt-2 max-w-2xl font-medium">
            Schedule upcoming driver practices, outreach events, machine shop slots, and scrimmages to keep the roster aligned.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="clipped-button bg-ares-red text-white hover:bg-ares-red-dark font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl focus:ring-2 focus:ring-ares-cyan focus:outline-none"
          >
            <Plus size={16} /> New Event
          </button>
        )}
      </header>

      {/* Guest Lockscreen Warning */}
      {!canEdit && (
        <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 text-center text-xs font-semibold max-w-lg mx-auto flex items-center gap-3 justify-center">
          <Shield size={16} className="text-ares-gold shrink-0" />
          <span>🔒 Read-only Guest Mode: Request authorization clearance to modify calendar events.</span>
        </div>
      )}

      {/* Schedule Index List */}
      <div className="glass-card border border-white/10 overflow-hidden ares-cut-lg shadow-xl">
        <div className="p-6 border-b border-white/5 bg-black/20 flex justify-between items-center text-xs font-black uppercase text-ares-gold tracking-widest">
          <span>Active Team Operations Timeline</span>
          <span>{events.length} Scheduled</span>
        </div>

        <div className="divide-y divide-white/5 bg-black/10">
          {events.length === 0 ? (
            <div className="p-12 text-center text-marble/40 text-xs font-mono">
              No events scheduled in the system calendar.
            </div>
          ) : (
            events.map((evt) => {
              const startDate = new Date(evt.dateStart);
              const isOutreach = evt.category === "outreach";

              return (
                <div
                  key={evt.id}
                  className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/5 transition-colors"
                >
                  <div className="flex gap-4.5 items-start">
                    {/* Category specific color block */}
                    <div
                      className={`w-3.5 h-3.5 mt-1.5 rounded-full shrink-0 ${
                        isOutreach ? "bg-ares-gold shadow-[0_0_10px_rgba(255,184,28,0.4)]" : "bg-ares-red shadow-[0_0_10px_rgba(192,0,0,0.4)]"
                      }`}
                      title={isOutreach ? "Outreach" : "Internal Practice"}
                    />

                    <div className="space-y-1.5 max-w-2xl">
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 border rounded ${
                          isOutreach
                            ? "bg-ares-gold/15 border-ares-gold/30 text-ares-gold"
                            : "bg-ares-red/15 border-ares-red/30 text-white"
                        }`}
                      >
                        {evt.category}
                      </span>
                      <h3 className="text-lg font-bold text-white font-heading uppercase tracking-tight">
                        {evt.title}
                      </h3>
                      {evt.description && (
                        <p className="text-marble/70 text-xs leading-relaxed">{evt.description}</p>
                      )}

                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1.5 text-[10px] font-bold text-marble/55 uppercase tracking-wide">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} className="text-marble/40" />
                          {startDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} className="text-marble/40" />
                          {startDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          {evt.dateEnd && ` - ${new Date(evt.dateEnd).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`}
                        </span>
                        {evt.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={11} className="text-marble/40" />
                            {evt.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 self-end md:self-auto shrink-0">
                    {canEdit ? (
                      <>
                        <button
                          onClick={() => handleOpenEdit(evt)}
                          className="p-2 bg-white/5 hover:bg-ares-gold/20 text-white/70 hover:text-white border border-white/10 rounded transition-all cursor-pointer text-xs focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                          title="Edit Event"
                          aria-label={`Edit event ${evt.title}`}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(evt.id)}
                          className="p-2 bg-white/5 hover:bg-ares-red/20 text-white/70 hover:text-ares-red-light border border-white/10 rounded transition-all cursor-pointer text-xs focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                          title="Delete Event"
                          aria-label={`Delete event ${evt.title}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    ) : (
                      <span className="text-[9px] text-marble/40 uppercase font-black tracking-widest">🔒 Locked</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Slide-out / Modal Event Editor Overlay */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            onClick={() => setIsEditorOpen(false)}
          />

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
                  onClick={() => setIsEditorOpen(false)}
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
                    activeTab === "edit" ? "border-ares-gold text-white" : "border-transparent text-marble/40 hover:text-white"
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
                        activeTab === "roster" ? "border-ares-gold text-white" : "border-transparent text-marble/40 hover:text-white"
                      }`}
                    >
                      👥 Roster & RSVPs
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("photos")}
                      className={`py-3 border-b-2 transition-all cursor-pointer ${
                        activeTab === "photos" ? "border-ares-gold text-white" : "border-transparent text-marble/40 hover:text-white"
                      }`}
                    >
                      🖼️ Gallery
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("revisions")}
                      className={`py-3 border-b-2 transition-all cursor-pointer ${
                        activeTab === "revisions" ? "border-ares-gold text-white" : "border-transparent text-marble/40 hover:text-white"
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
                <button onClick={() => setRevertAlert(null)} className="text-ares-gold hover:text-white cursor-pointer font-bold text-[10px] uppercase">
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
                        <label htmlFor="event-title" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Event Title</label>
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
                          <label htmlFor="event-start" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Start Date & Time</label>
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
                          <label htmlFor="event-end" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">End Date & Time</label>
                          <input
                            id="event-end"
                            type="datetime-local"
                            value={formDateEnd}
                            onChange={(e) => setFormDateEnd(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 text-marble/95 text-xs rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer focus:ring-2 focus:ring-ares-cyan"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="event-location" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Location / Venue</label>
                        <input
                          id="event-location"
                          type="text"
                          placeholder="e.g. MARS Laboratory / ARES Workshop"
                          value={formLocation}
                          onChange={(e) => setFormLocation(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
                        />
                      </div>

                      <div>
                        <label htmlFor="event-category" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Activity Category</label>
                        <select
                          id="event-category"
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value as any)}
                          className="w-full bg-black/60 border border-white/10 text-white text-xs font-bold uppercase rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer appearance-none focus:ring-2 focus:ring-ares-cyan"
                        >
                          <option value="internal">🛑 Internal Practice / Lab</option>
                          <option value="outreach">🏆 Public STEM Outreach</option>
                        </select>
                      </div>

                      {/* Cover Image Picker */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Event Cover Image</label>
                        <div className="flex items-center gap-3">
                          {formCoverImage ? (
                            <div className="relative w-20 h-12 bg-black border border-white/10 rounded overflow-hidden shrink-0">
                              <img src={formCoverImage} alt="Cover Preview" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setFormCoverImage("")}
                                className="absolute top-0 right-0 p-0.5 bg-black/80 hover:bg-ares-red text-white transition-colors"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ) : (
                            <div className="w-20 h-12 border border-dashed border-white/20 rounded flex items-center justify-center shrink-0 text-marble/30 text-[9px] uppercase font-mono">
                              No Cover
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => setIsPhotoPickerOpen(true)}
                            className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-bold uppercase tracking-widest text-white transition-all cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                          >
                            Pick Image
                          </button>
                        </div>
                      </div>

                      {/* Potluck and Volunteer Toggles */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-black/40 border border-white/5 p-3 rounded flex items-center justify-between">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-white">Potluck Event</label>
                            <span className="text-[9px] text-marble/50">Allow food signups</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFormIsPotluck(formIsPotluck === 1 ? 0 : 1)}
                            className={`w-10 h-5.5 rounded-full p-0.5 transition-colors cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none ${
                              formIsPotluck === 1 ? "bg-ares-red" : "bg-white/15"
                            }`}
                            aria-label="Toggle potluck"
                          >
                            <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform duration-200 ${
                              formIsPotluck === 1 ? "translate-x-4.5" : "translate-x-0"
                            }`} />
                          </button>
                        </div>

                        <div className="bg-black/40 border border-white/5 p-3 rounded flex items-center justify-between">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-white">Volunteer Hours</label>
                            <span className="text-[9px] text-marble/50">Track prep hours</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFormIsVolunteer(formIsVolunteer === 1 ? 0 : 1)}
                            className={`w-10 h-5.5 rounded-full p-0.5 transition-colors cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none ${
                              formIsVolunteer === 1 ? "bg-ares-red" : "bg-white/15"
                            }`}
                            aria-label="Toggle volunteer hours"
                          >
                            <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform duration-200 ${
                              formIsVolunteer === 1 ? "translate-x-4.5" : "translate-x-0"
                            }`} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="event-description" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Brief Summary</label>
                        <MarkdownEditor
                          id="event-description"
                          placeholder="Summarize target operational goals, tuning benchmarks, or logistics requirements..."
                          value={formDescription}
                          onChange={setFormDescription}
                          className="h-[250px]"
                        />
                      </div>
                    </div>
                  </form>

                  {/* AI Copilot Panel */}
                  {showAiSidebar && (
                    <div className="hidden lg:flex lg:w-[30%] bg-black/30 border border-white/15 rounded-xl p-4 flex-col gap-4 overflow-y-auto shrink-0 select-none scrollbar-thin scrollbar-thumb-white/5">
                      {/* Section 1: Spelling & Grammar Checker */}
                      <div className="space-y-4">
                        <div className="bg-black/20 border border-white/5 p-3.5 rounded-lg">
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-ares-gold flex items-center gap-2 mb-1.5">
                            <Sparkles size={11} /> Spelling & Grammar
                          </h4>
                          <p className="text-[9px] text-marble/60 leading-normal mb-2.5">
                            Gemini will scan the current editor contents for spelling errors and technical tone issues.
                          </p>
                          <button
                            type="button"
                            onClick={handleGrammarCheck}
                            disabled={aiLoading || !formDescription}
                            className="w-full py-2 bg-white/5 border border-white/10 hover:border-ares-gold hover:text-ares-gold transition-all text-white text-[9px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-40 focus:ring-2 focus:ring-ares-cyan"
                          >
                            {aiLoading ? "Checking..." : "Verify Spelling & Grammar"}
                          </button>
                        </div>

                        {/* Section 2: AI Writer Prompts */}
                        <div className="bg-black/20 border border-white/5 p-3.5 rounded-lg flex flex-col gap-2.5">
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-ares-cyan flex items-center gap-2">
                            <Sparkles size={11} /> AI Writer Prompts
                          </h4>
                          
                          <textarea
                            placeholder="Tell Gemini what to write, expand, or adjust..."
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            className="w-full h-16 bg-black/60 border border-white/10 rounded p-2.5 text-xs text-white placeholder:text-marble/25 focus:outline-none focus:border-ares-cyan font-mono leading-relaxed resize-none focus:ring-2 focus:ring-ares-cyan"
                          />

                          {/* Presets Grid */}
                          <div className="grid grid-cols-2 gap-1.5 text-[8px] font-black uppercase tracking-wider">
                            <button
                              type="button"
                              onClick={() => handleAiAssistant("Rewrite the content to make it sound more professional and academic.", "Improve Writing")}
                              disabled={aiLoading}
                              className="p-1.5 border border-white/5 bg-white/3 hover:bg-white/10 text-marble/80 hover:text-white rounded text-left transition-colors cursor-pointer focus:ring-2 focus:ring-ares-cyan"
                            >
                              💼 Professional
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAiAssistant("Expand this description, adding more technical details about practices, robotics training, and schedules.", "Expand Content")}
                              disabled={aiLoading}
                              className="p-1.5 border border-white/5 bg-white/3 hover:bg-white/10 text-marble/80 hover:text-white rounded text-left transition-colors cursor-pointer focus:ring-2 focus:ring-ares-cyan"
                            >
                              ➕ Expand
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAiAssistant("Summarize the entire event description, extracting key highlights suitable for a 2-sentence snippet.", "Summarize")}
                              disabled={aiLoading}
                              className="p-1.5 border border-white/5 bg-white/3 hover:bg-white/10 text-marble/80 hover:text-white rounded text-left transition-colors cursor-pointer focus:ring-2 focus:ring-ares-cyan"
                            >
                              ✂️ Summarize
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAiAssistant(aiPrompt)}
                              disabled={aiLoading || !aiPrompt.trim()}
                              className="p-1.5 bg-ares-cyan text-black hover:brightness-110 rounded text-center transition-all cursor-pointer font-bold disabled:opacity-40 focus:ring-2 focus:ring-ares-cyan"
                            >
                              🚀 Ask AI
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Output Sandbox */}
                      <div className="bg-black/30 border border-white/10 rounded-lg p-3.5 flex flex-col justify-between overflow-hidden min-h-[200px] flex-grow">
                        <div className="flex-grow overflow-y-auto pr-0.5 space-y-3.5 scrollbar-thin scrollbar-thumb-white/5">
                          <h4 className="text-[9px] font-bold uppercase tracking-wider text-marble/55">
                            Copilot Sandbox Output
                          </h4>

                          {aiLoading && (
                            <div className="flex flex-col items-center justify-center py-12 gap-2.5">
                              <span className="w-5 h-5 border-2 border-ares-gold border-t-transparent rounded-full animate-spin"></span>
                              <span className="text-[9px] text-marble/55 uppercase font-mono tracking-wider animate-pulse">
                                Brainstorming...
                              </span>
                            </div>
                          )}

                          {/* Render spelling corrections */}
                          {!aiLoading && grammarEdits.length > 0 && (
                            <div className="space-y-3">
                              <div className="p-2.5 bg-ares-gold/10 border border-ares-gold/20 text-ares-gold rounded text-[10px] leading-normal font-semibold">
                                Review corrections. Click <strong>Apply Correction</strong> below to insert.
                              </div>
                              
                              <div className="space-y-2">
                                {grammarEdits.map((edit, idx) => (
                                  <div key={idx} className="bg-black/45 border border-white/5 p-2 rounded text-[10px] leading-relaxed">
                                    <div className="flex flex-wrap gap-1 items-center mb-1 text-[8px] font-black uppercase tracking-wider">
                                      <span className="bg-ares-red/25 text-ares-red border border-ares-red/35 px-1 py-0.5 rounded line-through">
                                        {edit.original}
                                      </span>
                                      <span className="text-marble/55">➜</span>
                                      <span className="bg-ares-success/25 text-ares-success border border-ares-success/35 px-1 py-0.5 rounded">
                                        {edit.corrected}
                                      </span>
                                    </div>
                                    <p className="text-marble/75 mt-0.5">{edit.explanation}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Render assistant text */}
                          {!aiLoading && aiResponse && (
                            <div className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap text-marble bg-black/45 border border-white/5 p-3 rounded-lg overflow-x-auto">
                              {aiResponse}
                            </div>
                          )}

                          {!aiLoading && !aiResponse && grammarEdits.length === 0 && (
                            <div className="py-16 text-center text-[9px] font-mono text-marble/30 uppercase tracking-widest border border-dashed border-white/10 rounded-lg">
                              Output empty
                            </div>
                          )}
                        </div>

                        {/* Action buttons for outputs */}
                        {!aiLoading && (aiResponse || suggestedCorrection) && (
                          <div className="border-t border-white/5 pt-3 mt-3 flex flex-col gap-2 shrink-0">
                            {suggestedCorrection && grammarEdits.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setFormDescription(suggestedCorrection);
                                  setGrammarEdits([]);
                                  setSuggestedCorrection("");
                                  setRevertAlert("Applied grammar and spelling corrections to the draft!");
                                }}
                                className="w-full py-2.5 bg-ares-success text-white font-black uppercase tracking-widest text-[9px] ares-cut-sm cursor-pointer shadow-lg hover:brightness-105 transition-all focus:ring-2 focus:ring-ares-cyan"
                              >
                                Apply Correction
                              </button>
                            )}
                            {aiResponse && (
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormDescription(aiResponse);
                                    setAiResponse("");
                                    setRevertAlert("Replaced description with Gemini generated text!");
                                  }}
                                  className="py-2.5 bg-ares-cyan text-black font-black uppercase tracking-widest text-[8px] ares-cut-sm cursor-pointer shadow-lg hover:brightness-105 transition-all focus:ring-2 focus:ring-ares-cyan"
                                >
                                  Replace Draft
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormDescription(formDescription + "\n\n" + aiResponse);
                                    setAiResponse("");
                                    setRevertAlert("Appended Gemini response to description!");
                                  }}
                                  className="py-2.5 bg-white/5 border border-white/15 text-white font-black uppercase tracking-widest text-[8px] ares-cut-sm cursor-pointer shadow-lg hover:bg-white/10 transition-all focus:ring-2 focus:ring-ares-cyan"
                                >
                                  Append to Draft
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: ROSTER & RSVPS */}
              {activeTab === "roster" && (
                <div className="flex-grow overflow-y-auto space-y-6 pr-1 scrollbar-thin scrollbar-thumb-white/5">
                  
                  {/* RSVP Stats Grid */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-black/40 border border-white/5 p-3 rounded text-center">
                      <p className="text-marble/40 text-[9px] uppercase font-bold tracking-wider">Total RSVPs</p>
                      <p className="text-xl font-black text-white font-heading mt-1">{signups.length}</p>
                    </div>
                    <div className="bg-black/40 border border-white/5 p-3 rounded text-center">
                      <p className="text-marble/40 text-[9px] uppercase font-bold tracking-wider">Attended</p>
                      <p className="text-xl font-black text-ares-gold font-heading mt-1">
                        {signups.filter(s => s.attended).length}
                      </p>
                    </div>
                    <div className="bg-black/40 border border-white/5 p-3 rounded text-center">
                      <p className="text-marble/40 text-[9px] uppercase font-bold tracking-wider">Absent</p>
                      <p className="text-xl font-black text-marble/60 font-heading mt-1">
                        {signups.filter(s => !s.attended).length}
                      </p>
                    </div>
                  </div>

                  {/* Self RSVP Card */}
                  <div className="glass-card border border-white/10 p-5 rounded-lg space-y-4">
                    <h4 className="text-white font-extrabold text-sm uppercase tracking-tight flex items-center gap-2">
                      <Users size={14} className="text-ares-gold" />
                      {mySignup ? "Your RSVP Information" : "Join Event / RSVP"}
                    </h4>
                    
                    {signupError && (
                      <div className="p-3 bg-ares-red/10 border border-ares-red/20 text-white rounded text-xs">
                        ⚠️ {signupError}
                      </div>
                    )}

                    <form onSubmit={handleRsvpSubmit} className="space-y-4">
                      {formIsPotluck === 1 && (
                        <div>
                          <label htmlFor="potluck-bring" className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-marble/60">Potluck Contribution (What food/item are you bringing?)</label>
                          <input
                            id="potluck-bring"
                            type="text"
                            placeholder="e.g. 24 cans of soda, cookies, paper plates"
                            value={bringing}
                            onChange={(e) => setBringing(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-cyan"
                            required
                          />
                        </div>
                      )}

                      {formIsVolunteer === 1 && (
                        <div>
                          <label htmlFor="vol-hours" className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-marble/60">Volunteer Prep Hours (Estimated commitment)</label>
                          <input
                            id="vol-hours"
                            type="number"
                            min="0"
                            max="24"
                            step="0.5"
                            placeholder="Hours"
                            value={prepHours || ""}
                            onChange={(e) => setPrepHours(parseFloat(e.target.value) || 0)}
                            className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-cyan"
                          />
                        </div>
                      )}

                      <div>
                        <label htmlFor="rsvp-notes" className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-marble/60">Optional Notes</label>
                        <textarea
                          id="rsvp-notes"
                          placeholder="e.g. driving direct, arriving 15m late, need machine access"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="w-full h-16 bg-black/60 border border-white/10 rounded p-2 text-xs text-white focus:outline-none focus:border-ares-red resize-none focus:ring-2 focus:ring-ares-cyan"
                        />
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="submit"
                          disabled={submittingRsvp}
                          className="flex-grow py-2 bg-ares-red text-white hover:bg-ares-red-dark font-black uppercase tracking-widest text-[10px] rounded cursor-pointer transition-all shadow-md focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                        >
                          {submittingRsvp ? "Submitting..." : mySignup ? "Update RSVP" : "Confirm RSVP"}
                        </button>
                        {mySignup && (
                          <button
                            type="button"
                            onClick={handleRsvpCancel}
                            disabled={submittingRsvp}
                            className="px-4 py-2 border border-white/10 hover:bg-ares-red/10 text-marble/60 hover:text-white rounded text-[10px] uppercase font-black tracking-widest cursor-pointer transition-all focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                          >
                            Cancel RSVP
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  {/* Admin Checkin Roster Section */}
                  {isAdmin && (
                    <div className="glass-card border border-white/10 p-5 rounded-lg space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-white font-extrabold text-sm uppercase tracking-tight flex items-center gap-2">
                          <Shield size={14} className="text-ares-gold" />
                          Roster & Quick Check-in (Admin Only)
                        </h4>
                      </div>

                      {/* Quick Check-in search dropdown */}
                      <form onSubmit={handleQuickCheckin} className="flex gap-2">
                        <select
                          value={selectedMemberIdToCheckin}
                          onChange={(e) => setSelectedMemberIdToCheckin(e.target.value)}
                          className="flex-grow bg-black/60 border border-white/10 text-white text-xs rounded px-3 py-2 focus:outline-none focus:border-ares-red cursor-pointer focus:ring-2 focus:ring-ares-cyan"
                          aria-label="Select member to check in"
                        >
                          <option value="">-- Choose Member to Check-in --</option>
                          {displayedMembers
                            .filter(m => !signups.some(s => s.userId === m.uid && s.attended))
                            .map(m => (
                              <option key={m.uid} value={m.uid}>
                                {m.nickname}
                              </option>
                            ))}
                        </select>
                        <button
                          type="submit"
                          disabled={!selectedMemberIdToCheckin}
                          className="px-4 py-2 bg-ares-gold hover:bg-ares-gold/80 text-black font-black uppercase tracking-widest text-[10px] rounded cursor-pointer disabled:opacity-40 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                        >
                          Check In
                        </button>
                      </form>

                      {/* Real-time signups check-in list */}
                      <div className="border border-white/5 rounded overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-white/10 text-marble/40 uppercase font-black tracking-widest text-[9px] bg-black/30">
                              <th className="p-3">Member</th>
                              {formIsPotluck === 1 && <th className="p-3">Potluck</th>}
                              {formIsVolunteer === 1 && <th className="p-3">Hours</th>}
                              <th className="p-3">Notes</th>
                              <th className="p-3 text-right">Attendance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 bg-black/15">
                            {signups.length === 0 ? (
                              <tr>
                                <td colSpan={formIsPotluck === 1 && formIsVolunteer === 1 ? 5 : formIsPotluck === 1 || formIsVolunteer === 1 ? 4 : 3} className="p-6 text-center text-marble/40 font-mono text-[10px]">
                                  No members signed up yet.
                                </td>
                              </tr>
                            ) : (
                              signups.map((s) => (
                                <tr key={s.userId} className="hover:bg-white/3">
                                  <td className="p-3 font-semibold text-white">{s.nickname}</td>
                                  {formIsPotluck === 1 && (
                                    <td className="p-3 text-marble/70 font-medium">
                                      {s.bringing || <span className="text-marble/30 font-normal italic">None</span>}
                                    </td>
                                  )}
                                  {formIsVolunteer === 1 && (
                                    <td className="p-3 text-marble/70 font-mono">
                                      {s.prepHours !== undefined ? `${s.prepHours}h` : "-"}
                                    </td>
                                  )}
                                  <td className="p-3 text-marble/60 max-w-[150px] truncate" title={s.notes}>
                                    {s.notes || "-"}
                                  </td>
                                  <td className="p-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleAttendance(s.userId, !!s.attended)}
                                      className="p-1.5 inline-flex items-center gap-1 cursor-pointer transition-colors focus:ring-2 focus:ring-ares-cyan focus:outline-none rounded"
                                      title={s.attended ? "Click to set Absent" : "Click to Check-in"}
                                      aria-label={`Toggle attendance for ${s.nickname}`}
                                    >
                                      {s.attended ? (
                                        <CheckCircle2 size={15} className="text-ares-gold" />
                                      ) : (
                                        <Circle size={15} className="text-marble/30 hover:text-white" />
                                      )}
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                    </div>
                  )}

                </div>
              )}

              {/* Tab 3: PHOTOS & UPLOADS */}
              {activeTab === "photos" && (
                <div className="flex-grow flex flex-col gap-6 overflow-hidden min-h-0">
                  
                  {/* Photo Uploader Card */}
                  {canEdit && (
                    <div className="bg-black/35 border border-white/10 rounded-lg p-5 shrink-0">
                      <h4 className="text-white font-extrabold text-sm uppercase tracking-tight flex items-center gap-2 mb-3">
                        <Upload size={14} className="text-ares-gold" />
                        Upload Gallery Photo
                      </h4>
                      {uploadError && (
                        <div className="p-2.5 bg-ares-red/10 border border-ares-red/20 text-white rounded text-xs mb-3">
                          ⚠️ {uploadError}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4">
                        <label className="flex-grow border border-dashed border-white/20 hover:border-ares-gold/50 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-white/3 transition-all focus-within:ring-2 focus-within:ring-ares-cyan">
                          <ImageIcon size={22} className="text-marble/40 mb-1.5" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-marble/70">
                            {uploadingImage ? "Uploading to Cloud..." : "Select Event Photograph"}
                          </span>
                          <span className="text-[8px] text-marble/45 mt-0.5">PNG, JPG, or WEBP</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={uploadingImage}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Photo Gallery Grid */}
                  <div className="flex-grow overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5 min-h-0">
                    {photos.length === 0 ? (
                      <div className="py-20 text-center text-[10px] font-mono text-marble/35 uppercase tracking-widest border border-dashed border-white/10 rounded-lg">
                        No photographs uploaded yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {photos.map((ph) => (
                          <div
                            key={ph.id}
                            className="relative group aspect-video bg-black/60 border border-white/10 rounded overflow-hidden hover:border-ares-gold/50 transition-all cursor-pointer"
                          >
                            <img
                              src={ph.url}
                              alt={ph.filename}
                              onClick={() => setSelectedPhoto(ph)}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {canEdit && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePhoto(ph.id);
                                }}
                                className="absolute top-1.5 right-1.5 p-1 bg-black/80 hover:bg-ares-red text-white/70 hover:text-white rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ares-cyan"
                                title="Delete Photo"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                            <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/90 to-transparent text-[8px] text-marble/60 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                              By {ph.uploadedBy}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* Tab 4: REVISION HISTORY */}
              {activeTab === "revisions" && (
                <div className="flex-grow overflow-y-auto pr-1 space-y-4 scrollbar-thin scrollbar-thumb-white/5">
                  {loadingRevisions ? (
                    <div className="py-16 text-center text-marble/45 text-[10px] font-mono uppercase tracking-widest animate-pulse">
                      Retrieving edit logs...
                    </div>
                  ) : revisions.length === 0 ? (
                    <div className="py-16 text-center text-[10px] font-mono text-marble/35 uppercase tracking-widest border border-dashed border-white/10 rounded-lg">
                      No document changes logged.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {revisions.map((rev) => (
                        <div
                          key={rev.id}
                          className="bg-black/35 border border-white/5 rounded-lg p-4 flex items-start justify-between gap-4 hover:border-white/10 transition-colors"
                        >
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <img src={rev.editedByAvatar} alt="" className="w-5 h-5 rounded-full shrink-0 border border-white/10" />
                              <span className="text-xs font-bold text-white truncate">{rev.editedByName}</span>
                              <span className="text-[9px] font-mono text-marble/45">
                                {new Date(rev.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <h5 className="text-xs font-bold text-ares-gold uppercase truncate">{rev.title}</h5>
                            <p className="text-[10px] text-marble/60 line-clamp-2 leading-relaxed">
                              {rev.description || "No description changes."}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRevertToRevision(rev)}
                            className="px-3 py-1.5 border border-ares-gold/30 hover:bg-ares-gold/10 text-ares-gold hover:text-white rounded text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer shrink-0 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                          >
                            Revert
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            {activeTab === "edit" && (
              <footer className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 bg-black/20 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 border border-white/10 text-white font-semibold text-xs rounded hover:bg-white/5 transition-all cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEvent}
                  className="clipped-button-sm bg-ares-red text-white hover:bg-ares-red-dark font-black uppercase tracking-widest text-[11px] py-2 px-6 transition-all hover:scale-102 active:scale-98 cursor-pointer shadow-lg focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                >
                  {editId ? "Update Schedule" : "Add to Calendar"}
                </button>
              </footer>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4">
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-full transition-colors cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
            title="Close Lightbox"
            aria-label="Close Lightbox"
          >
            <X size={20} />
          </button>
          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center gap-3">
            <img src={selectedPhoto.url} alt={selectedPhoto.filename} className="max-w-full max-h-[75vh] object-contain rounded border border-white/10" />
            <div className="text-center text-xs text-marble/60 font-medium">
              <p className="text-white font-bold">{selectedPhoto.filename}</p>
              <p className="mt-1 text-[10px]">Uploaded by {selectedPhoto.uploadedBy} on {new Date(selectedPhoto.uploadedAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Photo Picker Modal */}
      <PhotoPickerModal
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onSelect={(url) => setFormCoverImage(url)}
      />

    </div>
  );
}

const MOCK_EVENTS: TeamEvent[] = [
  {
    id: "event_1",
    title: "Spark! Goes WILD Exhibition",
    dateStart: "2026-05-24T09:30:00",
    dateEnd: "2026-05-24T14:30:00",
    location: "SPARK! WV Museum",
    description: "Team outreach, STEM workshops, and public science bridge exhibits.",
    category: "outreach",
    isPotluck: 0,
    isVolunteer: 1
  },
  {
    id: "event_2",
    title: "Sunday Night Driver Practice",
    dateStart: "2026-05-24T18:00:00",
    dateEnd: "2026-05-24T20:30:00",
    location: "MARS Laboratory",
    description: "Weekly telemetry calibrations and driver practice on standard field.",
    category: "internal",
    isPotluck: 0,
    isVolunteer: 0
  },
  {
    id: "event_3",
    title: "Friday Night Hardware Lab",
    dateStart: "2026-05-29T18:00:00",
    dateEnd: "2026-05-29T20:00:00",
    location: "ARES Machine Shop",
    description: "Weekly hardware maintenance, linear slide adjustments, and intake tuning.",
    category: "internal",
    isPotluck: 0,
    isVolunteer: 0
  },
  {
    id: "event_4",
    title: "Sunday Night EKF Tuning",
    dateStart: "2026-05-31T18:00:00",
    dateEnd: "2026-05-31T20:30:00",
    location: "MARS Laboratory",
    description: "Main chassis odometry calibrations and autonomous state-slip test runs.",
    category: "internal",
    isPotluck: 0,
    isVolunteer: 0
  },
  {
    id: "event_5",
    title: "Overnight Scrimmage & Prep",
    dateStart: "2026-06-12T18:00:00",
    dateEnd: "2026-06-13T01:00:00",
    location: "Championship Scrimmage Field",
    description: "Extended overnight competition prep and match simulation.",
    category: "internal",
    isPotluck: 0,
    isVolunteer: 1
  },
  {
    id: "event_6",
    title: "FLL Robotics Mentorship Camp",
    dateStart: "2026-06-18T10:00:00",
    dateEnd: "2026-06-18T15:00:00",
    location: "Town Hall STEM Center",
    description: "Mentoring middle school FLL teams on mechanical design and FIRST® Core Values.",
    category: "outreach",
    isPotluck: 1,
    isVolunteer: 1
  }
];
