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
  orderBy
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import SEO from "@/components/SEO";
import ShareButtons from "@/components/ShareButtons";
import EventsManagementPage from "@/app/dashboard/events/page";
import { ASTNode } from "@/components/TiptapRenderer";

// Sub-components
import EventHero from "@/components/events/EventHero";
import EventDescription from "@/components/events/EventDescription";
import EventZulipLink from "@/components/events/EventZulipLink";
import EventGallery from "@/components/events/EventGallery";
import EventRsvps from "@/components/events/EventRsvps";
import EventVenueInfo from "@/components/events/EventVenueInfo";
import PhotoLightbox from "@/components/events/PhotoLightbox";
import { EventItem, EventSignup, EventPhoto } from "@/components/events/types";

import { TeamLocation } from "@/types/location";
import { MOCK_LOCATIONS } from "@/utils/constants";

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
  const isAdmin = !!(user && authorizedUser && (authorizedUser.role === "admin" || authorizedUser.role === "coach"));

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
      end.setHours(end.getHours() + 2);
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
      // Ignored
    }
    return null;
  }, [event?.description]);

  const gcalSingleUrl = useMemo(() => {
    if (!event) return "";
    try {
      const startStr = new Date(event.dateStart).toISOString().replace(/-|:|\.\d+/g, "");
      let endStr = "";
      if (event.dateEnd) {
        endStr = new Date(event.dateEnd).toISOString().replace(/-|:|\.\d+/g, "");
      } else {
        const end = new Date(event.dateStart);
        end.setHours(end.getHours() + 2);
        endStr = end.toISOString().replace(/-|:|\.\d+/g, "");
      }
      
      let plainTextDescription = event.description || "";
      if (parsedAst) {
        const getPlainText = (node: ASTNode): string => {
          if (node.text) return node.text;
          if (node.content) {
            return node.content.map(getPlainText).join(" ");
          }
          return "";
        };
        plainTextDescription = getPlainText(parsedAst);
      }

      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(plainTextDescription)}&location=${encodeURIComponent(event.location || "")}`;
    } catch {
      return "";
    }
  }, [event, parsedAst]);

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
      <SEO 
        title={event.title} 
        description={event.description || `Join team ARES 23247 at "${event.title}". Scheduled for ${new Date(event.dateStart).toLocaleDateString()} at ${event.location || 'Location TBA'}.`}
        image={event.coverImage}
        type="event"
        schemaData={{
          startDate: event.dateStart,
          endDate: event.dateEnd || event.dateStart,
          locationName: event.location || "Location TBA",
          locationAddress: (() => {
            const selected = event.locationId ? locations.find((l) => l.id === event.locationId) : null;
            return selected ? selected.address : (event.locationId === "mars-building" || event.location === "MARS Building") ? "123 Science Way, Morgantown, WV" : "Morgantown, WV";
          })()
        }}
      />

      <EventHero
        event={event}
        isPast={isPast}
        isVerified={isVerified}
        locations={locations}
        handleDownloadIcs={handleDownloadIcs}
        gcalSingleUrl={gcalSingleUrl}
        handleOpenInlineEdit={handleOpenInlineEdit}
      />

      {/* Main content split panel */}
      <section className="relative w-full max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Side: Description, Zulip Link, Gallery */}
        <article className="lg:col-span-8 space-y-12">
          <EventDescription event={event} parsedAst={parsedAst} />

          {/* Social Media Sharing */}
          <div className="pt-4">
            <ShareButtons title={event.title} theme="cyan" />
          </div>

          <EventZulipLink event={event} isVerified={isVerified} />

          <EventGallery
            isVerified={isVerified}
            uploadingImage={uploadingImage}
            uploadError={uploadError}
            photos={photos}
            handleImageUpload={handleImageUpload}
            setSelectedPhoto={setSelectedPhoto}
          />
        </article>

        {/* Right Side: RSVPs and signups, Venue Info */}
        <aside className="lg:col-span-4 space-y-6">
          <EventRsvps
            event={event}
            isVerified={isVerified}
            isAdmin={isAdmin}
            signups={signups}
            mySignup={mySignup}
            userId={user?.uid}
            bringing={bringing}
            setBringing={setBringing}
            notes={notes}
            setNotes={setNotes}
            prepHours={prepHours}
            setPrepHours={setPrepHours}
            signupError={signupError}
            submittingRsvp={submittingRsvp}
            handleRsvpSubmit={handleRsvpSubmit}
            handleRsvpCancel={handleRsvpCancel}
            handleToggleAttendance={handleToggleAttendance}
          />

          <EventVenueInfo event={event} locations={locations} />
        </aside>
      </section>

      <PhotoLightbox selectedPhoto={selectedPhoto} onClose={() => setSelectedPhoto(null)} />

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
