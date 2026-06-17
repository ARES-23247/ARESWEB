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
      category: formCategory
    };

    try {
      await setDoc(doc(db, "events", targetId), newEvent);
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

  return (
    <div className="space-y-10 w-full">
      
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
            className="clipped-button bg-ares-red text-white hover:bg-ares-red-dark font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl"
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
      <div className="glass-card border border-white/10 overflow-hidden ares-cut-lg">
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
                        isOutreach ? "bg-ares-gold shadow-[0_0_10px_rgba(212,175,55,0.4)]" : "bg-ares-red shadow-[0_0_10px_rgba(192,0,0,0.4)]"
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
                          className="p-2 bg-white/5 hover:bg-ares-gold/20 text-white/70 hover:text-white border border-white/10 rounded transition-all cursor-pointer text-xs"
                          title="Edit Event"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(evt.id)}
                          className="p-2 bg-white/5 hover:bg-ares-red/20 text-white/70 hover:text-ares-danger-soft border border-white/10 rounded transition-all cursor-pointer text-xs"
                          title="Delete Event"
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
          <div ref={editorRef} tabIndex={-1} className="relative z-10 w-full max-w-lg h-full bg-obsidian border-l border-white/10 flex flex-col justify-between animate-slide-in shadow-2xl focus:outline-none">
            <header className="px-6 py-4.5 border-b border-white/10 flex items-center justify-between bg-black/20">
              <div>
                <h3 className="text-white font-extrabold text-lg font-heading uppercase tracking-tight">
                  {editId ? "Edit Calendar Event" : "Schedule Team Operation"}
                </h3>
                <p className="text-[10px] text-marble/60 uppercase font-bold mt-0.5">
                  Synchronizes with public roster grids
                </p>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95"
              >
                <X size={16} />
              </button>
            </header>

            {/* Form Canvas */}
            <form onSubmit={handleSaveEvent} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Event Title</label>
                <input
                  type="text"
                  placeholder="e.g. Sunday Night EKF Odometry Calibrations"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formDateStart}
                    onChange={(e) => setFormDateStart(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 text-marble/95 text-xs rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formDateEnd}
                    onChange={(e) => setFormDateEnd(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 text-marble/95 text-xs rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Location / Venue</label>
                <input
                  type="text"
                  placeholder="e.g. MARS Laboratory / ARES Workshop"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Activity Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full bg-black/60 border border-white/10 text-white text-xs font-bold uppercase rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer appearance-none"
                >
                  <option value="internal">🛑 Internal Practice / Lab</option>
                  <option value="outreach">🏆 Public STEM Outreach</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Brief Summary</label>
                <MarkdownEditor
                  placeholder="Summarize target operational goals, tuning benchmarks, or logistics requirements..."
                  value={formDescription}
                  onChange={setFormDescription}
                  className="h-28"
                />
              </div>
            </form>

            <footer className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 bg-black/20">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 border border-white/10 text-white font-semibold text-xs rounded hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEvent}
                className="clipped-button-sm bg-ares-red text-white font-black uppercase tracking-widest text-[11px] py-2 px-6 transition-all hover:scale-102 active:scale-98 cursor-pointer shadow-lg"
              >
                {editId ? "Update Schedule" : "Add to Calendar"}
              </button>
            </footer>
          </div>
        </div>
      )}

    </div>
  );
}
