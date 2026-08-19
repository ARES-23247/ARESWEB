"use client";

import { logger } from "@/utils/logger";
import React, { useCallback, useEffect, useState, useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { doc, collection, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseFirestore";
import { useAuth } from "@/context/AuthContext";
import SEO from "@/components/SEO";
import ShareButtons from "@/components/ShareButtons";
import EventsManagementPage from "@/app/dashboard/events/page";
import { ASTNode } from "@/components/TiptapRenderer";
import { PublicDataState } from "@/components/PublicDataState";
import { toTiptapAst, toPlainText } from "@/lib/contentFormatters";

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
import { CalendarApiError, fetchLocations, fetchPublicEvent } from "@/app/calendar/api";
import { authenticatedFetch } from "@/lib/api";
import { resizeAndCompressImage } from "@/lib/image";

export default function EventDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [searchParams] = useSearchParams();
  const occurrenceDate = searchParams.get("occurrence") ?? undefined;
  const { user, authorizedUser } = useAuth();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventLoadError, setEventLoadError] = useState<string | null>(null);
  const [signups, setSignups] = useState<EventSignup[]>([]);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [photoLoadError, setPhotoLoadError] = useState<string | null>(null);
  const [locations, setLocations] = useState<TeamLocation[]>([]);

  // RSVP Form state
  const [bringing, setBringing] = useState("");
  const [notes, setNotes] = useState("");
  const [prepHours, setPrepHours] = useState(0);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [submittingRsvp, setSubmittingRsvp] = useState(false);
  const [updatingAttendance, setUpdatingAttendance] = useState<Set<string>>(new Set());
  const [signupsError, setSignupsError] = useState<string | null>(null);
  const [profileNickname, setProfileNickname] = useState("ARES Member");
  const [confirmRsvpCancel, setConfirmRsvpCancel] = useState(false);

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

  const loadEvent = useCallback(async () => {
    if (!id) return;
    setLoadingEvent(true);
    setEvent(null);
    try {
      const result = await fetchPublicEvent(id, occurrenceDate);
      setEvent(result as EventItem);
      setEventLoadError(null);
    } catch (error) {
      logger.error("Error fetching event details:", error);
      setEventLoadError(
        error instanceof CalendarApiError && error.status === 404
          ? null
          : error instanceof Error
            ? error.message
            : String(error),
      );
    } finally {
      setLoadingEvent(false);
    }
  }, [id, occurrenceDate]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  // Fetch Locations list
  useEffect(() => {
    if (!isVerified) return;
    void fetchLocations()
      .then(setLocations)
      .catch((error: unknown) => {
        logger.error("Unable to fetch event locations:", error);
      });
  }, [isVerified]);

  useEffect(() => {
    if (!isVerified) return;
    void authenticatedFetch("/api/profiles/me")
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          profile?: { nickname?: unknown };
          nickname?: unknown;
          error?: unknown;
        };
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText || "Request failed"}`);
        }
        const nickname = payload.profile?.nickname ?? payload.nickname;
        setProfileNickname(typeof nickname === "string" && nickname.trim() ? nickname : "ARES Member");
      })
      .catch((error: unknown) => {
        logger.error("Unable to load the RSVP nickname:", error);
        setSignupError(`Profile details unavailable: ${error instanceof Error ? error.message : String(error)}`);
      });
  }, [isVerified]);

  // 2. Fetch Signups in Real-time
  useEffect(() => {
    if (!id || !isVerified) return;
    const signupsRef = collection(db, "events", id, "signups");
    const unsubscribe = onSnapshot(
      signupsRef,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          userId: docSnap.id,
          ...docSnap.data(),
        })) as EventSignup[];
        setSignups(list);
      },
      (err) => {
        logger.warn("Unable to fetch event signups:", err);
        setSignupsError("The sign-up list is unavailable right now. Please try again.");
      },
    );
    return () => unsubscribe();
  }, [id, isVerified]);

  const loadPhotos = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      setLoadingPhotos(true);
      try {
        const photoParams = new URLSearchParams({ limit: "50" });
        if (occurrenceDate) photoParams.set("occurrence", occurrenceDate);
        const response = await fetch(
          `/api/calendar/events/${encodeURIComponent(id)}/photos?${photoParams.toString()}`,
          { signal },
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText || "Request failed"}`);
        }
        const payload = (await response.json()) as { photos?: unknown };
        if (!Array.isArray(payload.photos)) {
          throw new Error("Event photo response does not contain a photo list.");
        }
        const safePhotos = payload.photos.map((value): EventPhoto => {
          if (!value || typeof value !== "object") throw new Error("Event photo response contains an invalid photo.");
          const record = value as Record<string, unknown>;
          if (typeof record.id !== "string" || typeof record.url !== "string" || typeof record.filename !== "string") {
            throw new Error("Event photo response contains invalid fields.");
          }
          const thumbnailUrl =
            typeof record.thumbnailUrl === "string" && record.thumbnailUrl.startsWith("https://")
              ? record.thumbnailUrl
              : null;
          const mediumUrl =
            typeof record.mediumUrl === "string" && record.mediumUrl.startsWith("https://") ? record.mediumUrl : null;
          return {
            id: record.id,
            url: record.url,
            thumbnailUrl,
            mediumUrl,
            filename: record.filename,
            occurrenceDate: typeof record.occurrenceDate === "string" ? record.occurrenceDate : null,
          };
        });
        setPhotos(safePhotos);
        setPhotoLoadError(null);
      } catch (error) {
        if (signal?.aborted) return;
        logger.error("Unable to fetch public event photos:", error);
        setPhotoLoadError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!signal?.aborted) setLoadingPhotos(false);
      }
    },
    [id, occurrenceDate],
  );

  // 3. Fetch bounded public event-photo DTOs without exposing uploader metadata.
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setPhotos([]);
    setPhotoLoadError(null);
    void loadPhotos(controller.signal);
    return () => controller.abort();
  }, [id, loadPhotos]);

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

    const rsvpDoc: EventSignup = {
      userId: user.uid,
      nickname: profileNickname,
      attended: mySignup?.attended ?? false,
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
    } catch (err: unknown) {
      logger.error("Error submitting RSVP:", err);
      setSignupError(`RSVP failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmittingRsvp(false);
    }
  };

  // Cancel RSVP handler
  const handleRsvpCancel = () => {
    if (!id || !user || !isVerified) return;
    setConfirmRsvpCancel(true);
  };

  const executeRsvpCancel = async () => {
    if (!id || !user || !isVerified) return;
    setSignupError(null);
    setSubmittingRsvp(true);
    try {
      await deleteDoc(doc(db, "events", id, "signups", user.uid));
      setConfirmRsvpCancel(false);
    } catch (err: unknown) {
      logger.error("Error deleting RSVP:", err);
      setSignupError(`RSVP removal failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmittingRsvp(false);
    }
  };

  // Toggle RSVP attendance (for Admins or Self Check-in)
  const handleToggleAttendance = async (userId: string, currentStatus?: boolean) => {
    if (!id || !isVerified) return;
    const isSelf = user?.uid === userId;
    if (!isSelf && !isAdmin) return;
    if (updatingAttendance.has(userId)) return;
    setUpdatingAttendance((current) => new Set(current).add(userId));

    try {
      await setDoc(doc(db, "events", id, "signups", userId), { attended: !currentStatus }, { merge: true });
    } catch (err: unknown) {
      logger.error("Error updating attendance:", err);
      setSignupError(`Attendance update failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUpdatingAttendance((current) => {
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
    }
  };

  // 5. Image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !user || !isVerified) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadError("Upload a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError("Image size exceeds the 8MB limit.");
      return;
    }

    setUploadError(null);
    setUploadingImage(true);

    try {
      const compressed = await resizeAndCompressImage(file);
      const response = await authenticatedFetch("/api/photos/upload-unified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: compressed.base64,
          filename: file.name,
          mimeType: compressed.mimeType || file.type,
          runAiLabeling: false,
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${response.statusText || "Request failed"}${detail ? ` — ${detail}` : ""}`,
        );
      }
      const payload = (await response.json()) as {
        photo?: {
          id?: string;
          publicUrl?: string;
          thumbnailUrl?: string | null;
          mediumUrl?: string | null;
        };
      };
      if (!payload.photo?.id || !payload.photo.publicUrl) throw new Error("Upload response did not contain a photo.");

      const photoId = payload.photo.id;
      await setDoc(doc(db, "events", id, "photos", photoId), {
        url: payload.photo.publicUrl,
        thumbnailUrl: payload.photo.thumbnailUrl ?? null,
        mediumUrl: payload.photo.mediumUrl ?? null,
        uploadedBy: profileNickname,
        uploadedAt: new Date().toISOString(),
        filename: file.name,
        isDeleted: 0,
        occurrenceDate: occurrenceDate ?? null,
      });
      await loadPhotos();
    } catch (err: unknown) {
      logger.error("Image upload failed:", err);
      setUploadError(err instanceof Error ? err.message : String(err));
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
      ...(event.publicVenue ? [`LOCATION:${event.publicVenue.name}, ${event.publicVenue.address}`] : []),
      "END:VEVENT",
      "END:VCALENDAR",
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
    return toTiptapAst(event?.description);
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

      const plainTextDescription = toPlainText(event.description);
      const publicLocation = event.publicVenue ? `${event.publicVenue.name}, ${event.publicVenue.address}` : "";
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(plainTextDescription)}&location=${encodeURIComponent(publicLocation)}`;
    } catch {
      return "";
    }
  }, [event]);

  if (loadingEvent) {
    return (
      <div className="w-full min-h-screen bg-obsidian text-marble flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/10 border-t-ares-red rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!event) {
    if (eventLoadError) {
      return (
        <div className="min-h-screen w-full bg-obsidian px-6 py-24 text-marble">
          <div className="mx-auto max-w-3xl">
            <PublicDataState
              title="Unable to load this event"
              message="The event record could not be reached. Check your connection and try again."
              diagnostic={eventLoadError}
              onRetry={() => void loadEvent()}
            />
          </div>
        </div>
      );
    }
    return (
      <div className="w-full min-h-screen bg-obsidian text-marble flex flex-col items-center justify-center p-6 text-center">
        <SEO
          title="Event Not Found"
          description="This ARES 23247 calendar event does not exist or is no longer published."
          noindex
        />
        <h1 className="text-3xl font-black font-heading text-white uppercase mb-4">Event Record Lost</h1>
        <p className="text-marble/60 text-sm max-w-sm mb-6">
          This schedule item does not exist or has been removed from the calendar system.
        </p>
        <Link
          to="/calendar"
          className="clipped-button bg-ares-red text-white py-3 px-6 text-xs font-black uppercase tracking-widest"
        >
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
        description={
          event.description ||
          `See the published ARES 23247 schedule for “${event.title}” on ${new Date(event.dateStart).toLocaleDateString()}.`
        }
        image={event.coverImage}
        type={event.category === "outreach" && event.publicVenue ? "event" : "website"}
        schemaData={{
          startDate: event.dateStart,
          endDate: event.dateEnd,
          locationName: event.publicVenue?.name,
          locationAddress: event.publicVenue?.address,
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
            <ShareButtons title={event.title} theme="gold" />
          </div>

          <EventZulipLink event={event} isVerified={isVerified} />

          <EventGallery
            isVerified={isVerified}
            uploadingImage={uploadingImage}
            uploadError={uploadError}
            loadingPhotos={loadingPhotos}
            photoLoadError={photoLoadError}
            photos={photos}
            handleImageUpload={handleImageUpload}
            onRetryPhotos={() => void loadPhotos()}
            setSelectedPhoto={setSelectedPhoto}
            occurrenceDate={occurrenceDate}
          />
        </article>

        {/* Right Side: RSVPs and signups, Venue Info */}
        <aside className="lg:col-span-4 space-y-6">
          <EventRsvps
            event={event}
            isVerified={isVerified}
            isAdmin={isAdmin}
            signups={signups}
            signupsError={signupsError}
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

      <Dialog.Root
        open={confirmRsvpCancel}
        onOpenChange={(open) => !open && !submittingRsvp && setConfirmRsvpCancel(false)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[140] bg-black/80" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[141] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/15 bg-obsidian p-6 shadow-2xl focus:outline-none">
            <Dialog.Title className="text-lg font-black uppercase text-white">Cancel your RSVP?</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-marble/75">
              Your attendance record will be removed. You can RSVP again later.
            </Dialog.Description>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={submittingRsvp}
                  className="rounded border border-white/15 px-4 py-2 text-xs font-bold text-marble/75 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  Keep RSVP
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => void executeRsvpCancel()}
                disabled={submittingRsvp}
                className="rounded bg-ares-red px-4 py-2 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
              >
                {submittingRsvp ? "Removing…" : "Remove RSVP"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ─── UPGRADED FULL EVENT EDITOR DRAWER ─── */}
      {isEditorOpen && (
        <EventsManagementPage
          editorOnly={true}
          prefilledAction={editorAction}
          prefilledEventId={editorEventId}
          prefilledOccurrenceDate={occurrenceDate}
          onEditorClose={() => {
            setIsEditorOpen(false);
            setEditorAction(null);
            setEditorEventId(null);
            void loadEvent();
          }}
        />
      )}
    </div>
  );
}
