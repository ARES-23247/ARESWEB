"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  Calendar as CalendarIcon,
  MapPin,
  Info,
  Clock,
  ArrowLeft,
  Trash2,
  Users,
  CheckCircle2,
  Circle,
  AlertCircle,
  Plus,
  Save,
  Upload,
  Image as ImageIcon,
  MessageSquare,
  X,
  Maximize2,
  Pencil
} from "lucide-react";
import TiptapRenderer, { ASTNode } from "@/components/TiptapRenderer";
import { GreekMeander } from "@/components/GreekMeander";
import EventsManagementPage from "@/app/dashboard/events/page";

export interface TeamLocation {
  id: string;
  name: string;
  address: string;
  description?: string;
  gmapsUrl?: string;
}

export const MOCK_LOCATIONS: TeamLocation[] = [
  {
    id: "mars-building",
    name: "MARS Building",
    address: "123 Science Way, Morgantown, WV 26508",
    description: "Our primary design workshop, machining center, and practice arena.",
    gmapsUrl: "https://maps.google.com/?q=123+Science+Way+Morgantown+WV+26508"
  },
  {
    id: "ares-shop",
    name: "ARES Machine Shop",
    address: "456 Tech Lane, Morgantown, WV 26505",
    description: "CNC fabrication, 3D printing farm, and anodizing workshop.",
    gmapsUrl: "https://maps.google.com/?q=456+Tech+Lane+Morgantown+WV+26505"
  },
  {
    id: "spark-museum",
    name: "SPARK! WV Museum",
    address: "9500 Mall Road, Morgantown, WV 26501",
    description: "Community science museum where we host outreach events and demo days.",
    gmapsUrl: "https://maps.google.com/?q=Morgantown+Mall+WV+26501"
  }
];

interface EventItem {
  id: string;
  title: string;
  dateStart: string;
  dateEnd?: string;
  location?: string;
  locationId?: string;
  description?: string;
  category: "internal" | "outreach";
  coverImage?: string;
  meetingNotes?: string;
  zulipStream?: string;
  zulipTopic?: string;
  isPotluck?: number;
  isVolunteer?: number;
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

export default function EventDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user, authorizedUser } = useAuth();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [signups, setSignups] = useState<EventSignup[]>([]);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [locations, setLocations] = useState<TeamLocation[]>(MOCK_LOCATIONS);

  // RSVP Form state
  const [bringing, setBringing] = useState("");
  const [notes, setNotes] = useState("");
  const [prepHours, setPrepHours] = useState(0);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [submittingRsvp, setSubmittingRsvp] = useState(false);

  // Upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Lightbox state
  const [selectedPhoto, setSelectedPhoto] = useState<EventPhoto | null>(null);

  // Editor Drawer States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorAction, setEditorAction] = useState<"create" | "edit" | null>(null);
  const [editorEventId, setEditorEventId] = useState<string | null>(null);

  const handleOpenInlineEdit = () => {
    setEditorAction("edit");
    setEditorEventId(id || null);
    setIsEditorOpen(true);
  };

  const isVerified = !!(user && authorizedUser && authorizedUser.role !== "unverified");
  const isAdmin = !!(user && authorizedUser && authorizedUser.role === "admin");

  // 1. Fetch Event Detail
  useEffect(() => {
    if (!id) return;
    const docRef = doc(db, "events", id);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.isDeleted === 1) {
            setEvent(null);
          } else {
            setEvent({ id: docSnap.id, ...data } as EventItem);
          }
        } else {
          setEvent(null);
        }
        setLoadingEvent(false);
      },
      (err) => {
        console.error("Error fetching event details:", err);
        setLoadingEvent(false);
      }
    );
    return () => unsubscribe();
  }, [id]);

  // Fetch Locations list
  useEffect(() => {
    try {
      const locationsRef = collection(db, "locations");
      const unsubscribe = onSnapshot(
        locationsRef,
        (snapshot) => {
          if (snapshot.empty) {
            setLocations(MOCK_LOCATIONS);
            return;
          }
          const list = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              name: data.name || "",
              address: data.address || "",
              description: data.description || "",
              gmapsUrl: data.gmapsUrl || ""
            } as TeamLocation;
          });
          setLocations(list);
        },
        (err) => {
          console.warn("Unable to fetch locations in detail page:", err);
          setLocations(MOCK_LOCATIONS);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn("Unable to fetch locations in detail page:", e);
      setLocations(MOCK_LOCATIONS);
    }
  }, []);

  // 2. Fetch Signups in Real-time
  useEffect(() => {
    if (!id || !isVerified) return;
    const signupsRef = collection(db, "events", id, "signups");
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
  }, [id, isVerified]);

  // 3. Fetch Event Photos in Real-time
  useEffect(() => {
    if (!id) return;
    const photosRef = collection(db, "events", id, "photos");
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
  }, [id]);

  // Check if current user is signed up
  const mySignup = useMemo(() => {
    if (!user) return null;
    return signups.find((s) => s.userId === user.uid) || null;
  }, [signups, user]);

  // Resolve Google Maps URL for top header location link
  const topGmapsUrl = useMemo(() => {
    if (!event || !event.location) return "";
    const selected = event.locationId ? locations.find((l) => l.id === event.locationId) : null;
    const venueName = selected ? selected.name : event.location;
    const address = selected ? selected.address : (event.locationId === "mars-building" || event.location === "MARS Building") ? "123 Science Way, Morgantown, WV" : "";
    return selected?.gmapsUrl || `https://maps.google.com/maps?q=${encodeURIComponent(address || venueName)}`;
  }, [event, locations]);

  // Prefill RSVP form
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

  // 4. RSVP submission handler
  const handleRsvpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user || !isVerified) return;
    setSignupError(null);
    setSubmittingRsvp(true);

    let nickname = "ARES Member";
    try {
      const profileSnap = await getDoc(doc(db, "user_profiles", user.uid));
      if (profileSnap.exists()) {
        const data = profileSnap.data();
        nickname = data.nickname || "ARES Member";
      }
    } catch (err) {
      console.warn("Could not retrieve user profile for nickname:", err);
    }

    const rsvpDoc: Record<string, any> = {
      userId: user.uid,
      nickname,
      attended: mySignup?.attended ?? false
    };

    if (event?.isPotluck && bringing.trim()) {
      rsvpDoc.bringing = bringing.trim();
    }
    if (notes.trim()) {
      rsvpDoc.notes = notes.trim();
    }
    if (event?.isVolunteer) {
      rsvpDoc.prepHours = Number(prepHours) || 0;
    }

    try {
      await setDoc(doc(db, "events", id, "signups", user.uid), rsvpDoc);
    } catch (err: any) {
      console.error("Error submitting RSVP:", err);
      setSignupError(`RSVP failed: ${err.message || "Permission Denied or database offline."}`);
    } finally {
      setSubmittingRsvp(false);
    }
  };

  // Cancel RSVP handler
  const handleRsvpCancel = async () => {
    if (!id || !user || !isVerified) return;
    if (!confirm("Are you sure you want to cancel your RSVP?")) return;
    setSignupError(null);
    try {
      await deleteDoc(doc(db, "events", id, "signups", user.uid));
    } catch (err) {
      console.error("Error deleting RSVP:", err);
      setSignupError("Failed to cancel RSVP.");
    }
  };

  // Toggle RSVP attendance (for Admins or Self Check-in)
  const handleToggleAttendance = async (userId: string, currentStatus?: boolean) => {
    if (!id || !isVerified) return;
    // Gated: User can check in themselves, but only Admins can toggle other members
    const isSelf = user?.uid === userId;
    if (!isSelf && !isAdmin) return;

    try {
      const rsvpRef = doc(db, "events", id, "signups", userId);
      const rsvpSnap = await getDoc(rsvpRef);
      if (rsvpSnap.exists()) {
        await setDoc(rsvpRef, { attended: !currentStatus }, { merge: true });
      }
    } catch (err) {
      console.error("Error updating attendance:", err);
    }
  };

  // 5. Image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !user || !isVerified) return;
    
    // File validation
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are permitted.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError("Image size exceeds the 8MB limit.");
      return;
    }

    setUploadError(null);
    setUploadingImage(true);

    try {
      const storagePath = `events/${id}/photos/${Date.now()}_${file.name}`;
      const imageRef = ref(storage, storagePath);
      
      // Upload to Firebase Storage
      const snapshot = await uploadBytes(imageRef, file);
      const url = await getDownloadURL(snapshot.ref);

      let uploaderNickname = "ARES Member";
      try {
        const profileSnap = await getDoc(doc(db, "user_profiles", user.uid));
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          uploaderNickname = data.nickname || "ARES Member";
        }
      } catch (err) {
        console.warn("Could not retrieve user profile for nickname:", err);
      }

      // Save metadata to Firestore
      const photoId = `photo_${Date.now()}`;
      await setDoc(doc(db, "events", id, "photos", photoId), {
        url,
        uploadedBy: uploaderNickname,
        uploadedAt: new Date().toISOString(),
        filename: file.name
      });
    } catch (err: any) {
      console.error("Image upload failed:", err);
      setUploadError("Image upload failed. Storage permissions or emulator connectivity fault.");
    } finally {
      setUploadingImage(false);
    }
  };

  // 6. Download ICS calendar file
  const handleDownloadIcs = () => {
    if (!event) return;
    const startStr = new Date(event.dateStart).toISOString().replace(/-|:|\.\d+/g, "");
    let endStr = "";
    if (event.dateEnd) {
      endStr = new Date(event.dateEnd).toISOString().replace(/-|:|\.\d+/g, "");
    } else {
      const end = new Date(event.dateStart);
      end.setHours(end.getHours() + 2); // Default 2 hours
      endStr = end.toISOString().replace(/-|:|\.\d+/g, "");
    }

    const icsData = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `SUMMARY:${event.title}`,
      `LOCATION:${event.location || "TBD"}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Try to parse description as Tiptap AST
  const parsedAst = useMemo<ASTNode | null>(() => {
    if (!event?.description) return null;
    try {
      const parsed = JSON.parse(event.description);
      if (parsed && typeof parsed === "object" && parsed.type === "doc") {
        return parsed as ASTNode;
      }
    } catch {
      // Ignored: treat as legacy html/plain text
    }
    return null;
  }, [event?.description]);

  if (loadingEvent) {
    return (
      <div className="w-full min-h-screen bg-obsidian text-marble flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/10 border-t-ares-red rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="w-full min-h-screen bg-obsidian text-marble flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-black font-heading text-white uppercase mb-4">Event Record Lost</h1>
        <p className="text-marble/60 text-sm max-w-sm mb-6">This schedule item does not exist or has been removed from the calendar system.</p>
        <Link to="/calendar" className="clipped-button bg-ares-red text-white py-3 px-6 text-xs font-black uppercase tracking-widest">
          ← Return to Calendar
        </Link>
      </div>
    );
  }

  const startDate = new Date(event.dateStart);
  const isPast = startDate < new Date();

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      {/* Hero Cover Image Section */}
      <section className="relative w-full h-[45vh] min-h-[350px] flex items-center overflow-hidden bg-obsidian border-b-4 border-ares-bronze">
        <GreekMeander variant="thick" opacity="opacity-50" className="absolute bottom-[-1px] left-0 z-10" />
        
        <img
          src={event.coverImage || "/favicon.png"}
          alt={event.title}
          className={event.coverImage ? "absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-luminosity" : "absolute inset-0 m-auto w-32 h-32 opacity-25 mix-blend-luminosity object-contain"}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/60 to-transparent"></div>
        
        <div className="relative z-10 max-w-5xl mx-auto px-6 w-full mt-16">
          <Link
            to="/calendar"
            className="text-ares-gold hover:text-white uppercase tracking-widest text-[10px] font-black transition-all flex items-center gap-2 mb-6 w-fit"
          >
            <span>&larr;</span> Back to calendar
          </Link>
          
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span
              className={`w-fit px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded ${
                isPast
                  ? "bg-white/10 text-marble/60"
                  : "bg-ares-red/20 text-white border border-ares-red/35 shadow-[0_0_15px_rgba(192,0,0,0.3)] animate-pulse"
              }`}
            >
              {isPast ? "Historical Record" : "Upcoming Event"}
            </span>
            
            {!isPast && (
              <button
                onClick={handleDownloadIcs}
                className="w-fit flex items-center gap-1.5 px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest bg-black/80 hover:bg-ares-gold text-white hover:text-black border border-white/15 hover:border-ares-gold transition-all cursor-pointer"
              >
                <CalendarIcon size={12} /> Add to calendar
              </button>
            )}

            {isVerified && (
              <button
                onClick={handleOpenInlineEdit}
                className="w-fit flex items-center gap-1.5 px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest bg-black/80 hover:bg-ares-gold text-white hover:text-black border border-white/15 hover:border-ares-gold transition-all cursor-pointer"
              >
                <Pencil size={12} /> Edit Event
              </button>
            )}
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-white leading-tight uppercase font-heading drop-shadow-2xl">
            {event.title}
          </h1>

          <div className="mt-6 flex flex-col md:flex-row gap-x-8 gap-y-2 text-marble/80 font-bold text-sm md:text-base">
            <div className="flex flex-col">
              <p className="flex items-center gap-1.5 text-ares-bronze">
                <span className="text-white font-extrabold uppercase text-xs tracking-wider">Start:</span>{" "}
                {startDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}{" "}
                at {startDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </p>
              {event.dateEnd && (
                <p className="flex items-center gap-1.5 text-ares-bronze">
                  <span className="text-white font-extrabold uppercase text-xs tracking-wider">End:</span>{" "}
                  {new Date(event.dateEnd).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}{" "}
                  at {new Date(event.dateEnd).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
            {event.location && (
              <div className="flex items-start md:items-center gap-1.5">
                <span className="text-white font-extrabold uppercase text-xs tracking-wider">Location:</span>
                <a
                  href={topGmapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 text-ares-bronze hover:text-white transition-colors"
                >
                  {event.location} ↗
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main content split panel */}
      <section className="relative w-full max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Side: Description and Zulip */}
        <article className="lg:col-span-8 space-y-12">
          <div className="prose prose-invert max-w-none">
            {parsedAst ? (
              <TiptapRenderer node={parsedAst} />
            ) : (
              <p className="whitespace-pre-wrap text-base md:text-lg leading-relaxed text-marble/90">{event.description}</p>
            )}
          </div>

          {/* Zulip Thread Link */}
          {isVerified && (event.zulipStream || event.zulipTopic) && (
            <div className="p-6 bg-black/40 border border-white/10 ares-cut flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-ares-gold/15 flex items-center justify-center border border-ares-gold/20 shrink-0">
                <MessageSquare size={18} className="text-ares-gold" />
              </div>
              <div className="space-y-2 w-full">
                <h4 className="text-sm font-black text-white uppercase tracking-wider">Event Discussions (Zulip Feed)</h4>
                <p className="text-xs text-marble/70 leading-relaxed">
                  Join discussions for logistics, practices, and recaps directly inside the ARES chat system.
                </p>
                <a
                  href={`https://zulip.aresfirst.org/#narrow/stream/${encodeURIComponent(event.zulipStream || "events")}/topic/${encodeURIComponent(event.zulipTopic || `Event: ${event.title}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ares-gold hover:brightness-110 text-black text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer shadow-md mt-2"
                >
                  Open Zulip Thread ↗
                </a>
              </div>
            </div>
          )}

          {/* Photos Feed Section */}
          <div className="space-y-6 pt-6 border-t border-white/5">
            <header className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight font-heading">Event Gallery</h3>
                <p className="text-[10px] text-marble/50 uppercase font-bold mt-0.5">Media captured from this operation</p>
              </div>

              {/* Upload photo button */}
              {isVerified && (
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    id="photo-upload-input"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                  />
                  <label
                    htmlFor="photo-upload-input"
                    className="px-3 py-1.5 border border-white/10 hover:border-ares-gold bg-white/5 hover:bg-white/10 text-marble hover:text-ares-gold text-[9px] font-black uppercase tracking-widest ares-cut-sm inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {uploadingImage ? (
                      <span className="w-3 h-3 border-2 border-ares-gold border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <Upload size={12} />
                    )}
                    Upload Photo
                  </label>
                </div>
              )}
            </header>

            {uploadError && (
              <div className="p-3.5 bg-ares-red/10 border border-ares-red/20 text-ares-red text-xs rounded-lg flex items-center gap-2">
                <AlertCircle size={14} /> {uploadError}
              </div>
            )}

            {photos.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-white/10 rounded-2xl bg-black/10 text-marble/30 text-xs font-mono">
                <ImageIcon size={32} className="mx-auto mb-3 opacity-25" />
                No photos have been uploaded for this event.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {photos.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedPhoto(item)}
                    className="aspect-square relative overflow-hidden group cursor-pointer ares-cut border border-white/10 bg-black/40"
                  >
                    <img
                      src={item.url}
                      alt={item.filename}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103 opacity-80 group-hover:opacity-100"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 text-left">
                      <span className="text-[7px] text-white/55 font-bold uppercase truncate">{item.filename}</span>
                      <span className="text-[8px] text-ares-gold font-black uppercase tracking-wide truncate">By {item.uploadedBy?.includes("@") ? "ARES Member" : item.uploadedBy || "ARES Member"}</span>
                    </div>
                    <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center border border-white/15 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 size={10} className="text-white" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </article>

        {/* Right Side: RSVPs and signups */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="glass-card border border-white/10 p-6 rounded-2xl bg-black/20 space-y-6">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight font-heading flex items-center gap-2">
                <Users size={16} className="text-ares-red" /> Team Sign-Ups
              </h3>
              <p className="text-[10px] text-marble/60 uppercase font-bold mt-1">Roster check-ins and commitments</p>
            </div>

            {isVerified ? (
              <div className="space-y-6">
                {/* RSVP Stats */}
                <div className="grid grid-cols-2 gap-4 border-y border-white/5 py-4">
                  <div className="text-left">
                    <span className="text-[9px] font-black text-marble/45 uppercase tracking-wider block">Going / RSVP</span>
                    <span className="text-2xl font-black text-white mt-1 block">
                      {signups.length} <span className="text-xs font-bold text-marble/60">present</span>
                    </span>
                  </div>
                  {event.isVolunteer === 1 && (
                    <div className="text-left">
                      <span className="text-[9px] font-black text-marble/45 uppercase tracking-wider block">Volunteer Prep</span>
                      <span className="text-2xl font-black text-ares-gold mt-1 block">
                        {signups.reduce((acc, s) => acc + (s.prepHours || 0), 0)} <span className="text-xs font-bold text-marble/60">hrs</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* RSVP Status Form */}
                <form onSubmit={handleRsvpSubmit} className="space-y-4 pt-2">
                  <h4 className="text-[10px] font-black uppercase text-ares-gold tracking-widest">
                    {mySignup ? "✓ Update RSVP details" : "+ Submit your RSVP"}
                  </h4>

                  {signupError && (
                    <div className="p-3 bg-ares-red/10 border border-ares-red/20 text-ares-red text-xs rounded-lg flex items-center gap-1.5">
                      <AlertCircle size={14} /> {signupError}
                    </div>
                  )}

                  {event.isPotluck === 1 && (
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-wider mb-2 text-marble/55">Bringing Food/Drinks</label>
                      <input
                        type="text"
                        placeholder="Chips, cookies, sodas..."
                        value={bringing}
                        onChange={(e) => setBringing(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded px-3.5 py-2 text-xs text-white focus:outline-none focus:border-ares-red transition-colors"
                      />
                    </div>
                  )}

                  {event.isVolunteer === 1 && (
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-wider mb-2 text-marble/55">Volunteer Prep Hours</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="20"
                        placeholder="Hours contributed"
                        value={prepHours || ""}
                        onChange={(e) => setPrepHours(parseFloat(e.target.value) || 0)}
                        className="w-full bg-black/60 border border-white/10 rounded px-3.5 py-2 text-xs text-white focus:outline-none focus:border-ares-red transition-colors"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider mb-2 text-marble/55">Notes / Arrival Time</label>
                    <input
                      type="text"
                      placeholder="e.g. Arriving 30 mins late, etc."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded px-3.5 py-2 text-xs text-white focus:outline-none focus:border-ares-red transition-colors"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={submittingRsvp}
                      className="flex-1 px-4 py-2.5 bg-ares-gold hover:brightness-110 text-black text-[10px] font-black uppercase tracking-widest ares-cut-sm transition-all cursor-pointer shadow-lg disabled:opacity-50"
                    >
                      {mySignup ? "Save Details" : "RSVP (Going)"}
                    </button>
                    {mySignup && (
                      <button
                        type="button"
                        onClick={handleRsvpCancel}
                        className="px-3 py-2.5 bg-white/5 hover:bg-ares-red/10 border border-white/10 hover:border-ares-red/40 text-marble hover:text-ares-red text-[10px] font-black uppercase tracking-widest ares-cut-sm transition-all cursor-pointer"
                      >
                        Cancel RSVP
                      </button>
                    )}
                  </div>
                </form>

                {/* RSVP Attendance Check-in Button */}
                {mySignup && (
                  <button
                    onClick={() => handleToggleAttendance(user.uid, mySignup.attended)}
                    className={`w-full flex items-center justify-center gap-1.5 py-2 border rounded text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                      mySignup.attended
                        ? "bg-ares-red/15 border-ares-red/45 text-white"
                        : "bg-white/5 border-white/10 hover:border-ares-gold hover:text-ares-gold text-marble"
                    }`}
                  >
                    <CheckCircle2 size={12} />
                    {mySignup.attended ? "Checked In (Undo)" : "Check In to Event"}
                  </button>
                )}

                {/* RSVP List Table */}
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <h4 className="text-[10px] font-black uppercase text-marble/55 tracking-wider">RSVP List</h4>
                  {signups.length === 0 ? (
                    <p className="text-[10px] text-marble/40 font-mono">No sign-ups registered yet.</p>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {signups.map((entry) => (
                        <div key={entry.userId} className="py-2.5 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            {isAdmin ? (
                              <button
                                onClick={() => handleToggleAttendance(entry.userId, entry.attended)}
                                className={`shrink-0 transition-colors ${
                                  entry.attended ? "text-ares-gold" : "text-white/10 hover:text-white/30"
                                }`}
                              >
                                {entry.attended ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                              </button>
                            ) : (
                              <div className={`shrink-0 ${entry.attended ? "text-ares-gold" : "text-white/10"}`}>
                                {entry.attended ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                              </div>
                            )}
                            <div className="overflow-hidden">
                              <span className="text-xs font-bold text-white block truncate">{entry.nickname?.includes("@") ? "ARES Member" : entry.nickname || "ARES Member"}</span>
                              {entry.bringing && (
                                <span className="text-[9px] text-ares-gold truncate block font-medium">Brings: {entry.bringing}</span>
                              )}
                              {entry.notes && (
                                <span className="text-[8px] text-marble/50 block truncate font-mono">{entry.notes}</span>
                              )}
                            </div>
                          </div>
                          {entry.prepHours && entry.prepHours > 0 && (
                            <span className="text-[9px] font-bold text-marble/60 shrink-0 font-mono bg-white/5 px-2 py-0.5 rounded">
                              {entry.prepHours}h
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center p-6 border border-white/5 bg-black/30 rounded-xl">
                <ShieldIconContainer />
                <h4 className="text-xs font-extrabold uppercase text-white mt-3">Verified Clearance Required</h4>
                <p className="text-[10px] text-marble/50 leading-relaxed mt-2">
                  Access to event rosters and RSVP actions is restricted to authorized team members.
                </p>
                <Link
                  to="/calendar"
                  className="mt-4 inline-block px-4 py-2 bg-white/5 border border-white/10 text-white hover:text-ares-gold text-[9px] font-black uppercase tracking-widest transition-colors"
                >
                  Return to calendar
                </Link>
              </div>
            )}
          </div>

          {/* Venue Info Card */}
          {(event.locationId || event.location) && (
            (() => {
              const selected = event.locationId ? locations.find((l) => l.id === event.locationId) : null;
              const venueName = selected ? selected.name : event.location || "MARS Building";
              const address = selected ? selected.address : (event.locationId === "mars-building" || event.location === "MARS Building") ? "123 Science Way, Morgantown, WV" : "";
              const gmapsUrl = selected?.gmapsUrl || `https://maps.google.com/maps?q=${encodeURIComponent(address || venueName)}`;
              const description = selected?.description || "";
              
              return (
                <div className="glass-card border border-white/10 p-6 rounded-2xl bg-black/20 space-y-4 text-left animate-fade-in">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight font-heading flex items-center gap-2">
                      <MapPin size={16} className="text-ares-gold" /> Venue Information
                    </h3>
                    <p className="text-[9px] text-marble/50 uppercase font-bold mt-0.5">Directions and facility details</p>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">{venueName}</h4>
                      {address && (
                        <p className="text-[11px] text-marble/70 leading-relaxed mt-1 font-semibold">{address}</p>
                      )}
                      {description && (
                        <p className="text-[10px] text-marble/40 leading-relaxed italic mt-1.5">{description}</p>
                      )}
                    </div>
                    
                    {gmapsUrl && (
                      <a
                        href={gmapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-center block py-2 bg-white/5 hover:bg-ares-gold border border-white/10 hover:border-ares-gold text-marble hover:text-black text-[9px] font-black uppercase tracking-widest ares-cut-sm transition-all cursor-pointer shadow-md"
                      >
                        Get Directions ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </aside>
      </section>

      {/* Fullscreen Photo Lightbox Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setSelectedPhoto(null)} />
          
          <div className="relative z-10 w-full max-w-4xl bg-obsidian border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col justify-between max-h-[90vh]">
            <header className="w-full flex items-center justify-between border-b border-white/5 pb-3.5">
              <div>
                <span className="text-[10px] text-marble/40 font-mono">
                  Uploaded by {selectedPhoto.uploadedBy?.includes("@") ? "ARES Member" : selectedPhoto.uploadedBy || "ARES Member"} &middot; {new Date(selectedPhoto.uploadedAt).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="text-marble/55 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </header>

            <div className="w-full flex-grow flex items-center justify-center my-6 overflow-hidden">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.filename}
                className="w-full h-auto max-h-[60vh] object-contain rounded-lg border border-white/5"
              />
            </div>

            <footer className="w-full border-t border-white/5 pt-3.5 flex justify-between items-center text-xs">
              <p className="text-marble/60 font-semibold truncate max-w-lg">{selectedPhoto.filename}</p>
              <a
                href={selectedPhoto.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 border border-white/10 hover:border-ares-gold text-marble hover:text-ares-gold text-[9px] font-black uppercase tracking-widest transition-colors"
              >
                Open Original ↗
              </a>
            </footer>
          </div>
        </div>
      )}

      {/* ─── UPGRADED FULL EVENT EDITOR DRAWER ─── */}
      {isEditorOpen && (
        <EventsManagementPage
          editorOnly={true}
          prefilledAction={editorAction}
          prefilledEventId={editorEventId}
          onEditorClose={() => {
            setIsEditorOpen(false);
            setEditorAction(null);
            setEditorEventId(null);
          }}
        />
      )}
    </div>
  );
}

function ShieldIconContainer() {
  return (
    <div className="w-10 h-10 rounded-full bg-ares-gold/15 flex items-center justify-center border border-ares-gold/20 mx-auto">
      <Users size={18} className="text-ares-gold" />
    </div>
  );
}
