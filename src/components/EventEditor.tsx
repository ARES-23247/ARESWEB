import { useParams, useNavigate } from "react-router-dom";
import { useRichEditor } from "./editor/useRichEditor";
import RichEditorToolbar from "./editor/RichEditorToolbar";
import AssetPickerModal from "./AssetPickerModal";
import { MapPin, RefreshCw } from "lucide-react";
import EventPotluckVolunteerFlags from "./events/EventPotluckVolunteerFlags";
import SocialSyndicationGrid from "./editor/SocialSyndicationGrid";
import CoverAssetPicker from "./editor/CoverAssetPicker";
import EditorFooter from "./editor/EditorFooter";
import SeasonPicker from "./SeasonPicker";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { eventSchema, EventPayload } from "@shared/schemas/eventSchema";
import { api } from "../api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminSettings } from "../hooks/useAdminSettings";
import { useImageUpload } from "../hooks/useImageUpload";
import { useModal } from "../contexts/ModalContext";
import { DEFAULT_COVER_IMAGE } from "../utils/constants";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export interface LocationRow {
  id: string;
  name: string;
  address: string;
}

export default function EventEditor({ userRole }: { userRole?: string | unknown }) {
  const { editId } = useParams<{ editId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const modal = useModal();
  const editor = useRichEditor({ placeholder: "<p>Describe your upcoming event or write a full recap here...</p>" });
  const notesEditor = useRichEditor({ placeholder: "<p>Add private meeting notes here (visible to verified members only)...</p>" });
  
  const { availableSocials } = useAdminSettings();
  const { uploadFile, isUploading, setErrorMsg: setUploadError } = useImageUpload();

  const [isDeleted, setIsDeleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<z.input<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      dateStart: "",
      dateEnd: "",
      location: "",
      description: "",
      coverImage: DEFAULT_COVER_IMAGE,
      category: "internal",
      tbaEventKey: "",
      isPotluck: false,
      isVolunteer: false,
      publishedAt: "",
      seasonId: "",
      meetingNotes: "",
      socials: {
        discord: true,
        bluesky: true,
        slack: false,
        teams: false,
        gchat: false,
        facebook: false,
        twitter: false,
        instagram: false
      }
    }
  });

  const formValues = useWatch({ control });
  const socials = formValues.socials || {};

  const { data: locations = [] } = useQuery<LocationRow[]>({
    queryKey: ["locations"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/locations");
        if (res.ok) {
          const data = (await res.json()) as { locations?: LocationRow[] };
          return data.locations || [];
        }
        return [];
      } catch {
        return [];
      }
    }
  });

  // Use standard API query instead of useEntityFetch
  const { data: eventRes, isLoading, isError } = api.events.adminDetail.useQuery(
    ["admin_event_detail", editId || ""],
    {
      params: { id: editId || "" }
    },
    {
      enabled: !!editId
    }
  );

  useEffect(() => {
    if (eventRes?.status === 200 && eventRes.body.event) {
      const event = eventRes.body.event;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsDeleted(event.is_deleted === 1);
      reset({
        title: event.title || "",
        dateStart: event.date_start || "",
        dateEnd: event.date_end || "",
        location: event.location || "",
        description: event.description || "",
        coverImage: event.cover_image || DEFAULT_COVER_IMAGE,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        category: (event.category || "internal") as any,
        tbaEventKey: event.tba_event_key || "",
        isPotluck: event.is_potluck === 1,
        isVolunteer: event.is_volunteer === 1,
        publishedAt: event.published_at || "",
        seasonId: event.season_id ? String(event.season_id) : "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        socials: (socials as any) || {}
      });
      if (editor) {
        try {
          editor.commands.setContent(JSON.parse(event.description));
        } catch {
          editor.commands.setContent(`<p>${event.description}</p>`);
        }
      }
      if (notesEditor && event.meeting_notes) {
        try {
          notesEditor.commands.setContent(JSON.parse(event.meeting_notes));
        } catch {
          notesEditor.commands.setContent(`<p>${event.meeting_notes}</p>`);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventRes, reset, editor, notesEditor]);


  const saveMutation = api.events.saveEvent.useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      if (data.status === 200) {
        toast.success("Event published!");
        if (data.body.warning) toast.info(data.body.warning);

        queryClient.invalidateQueries({ queryKey: ["events"] });
        queryClient.invalidateQueries({ queryKey: ["admin_events"] });
        navigate("/dashboard");
      } else {
        setErrorMsg(data.body.error || "Event save failed.");
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      setErrorMsg(err.message || "Network error.");
    }
  });

  const updateMutation = api.events.updateEvent.useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      if (data.status === 200) {
        toast.success("Event updated!");
        if (data.body?.warning) toast.info(data.body.warning);

        queryClient.invalidateQueries({ queryKey: ["events"] });
        queryClient.invalidateQueries({ queryKey: ["admin_events"] });
        if (editId) queryClient.invalidateQueries({ queryKey: ["event", editId] });
        navigate("/dashboard");
      } else {
        setErrorMsg(data.body?.error || "Event update failed.");
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      setErrorMsg(err.message || "Network error.");
    }
  });

  const deleteMutation = api.events.deleteEvent.useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      if (data.status === 200) {
        queryClient.invalidateQueries({ queryKey: ["events"] });
        queryClient.invalidateQueries({ queryKey: ["admin_events"] });
        navigate("/dashboard");
      } else {
        setErrorMsg("Failed to delete the event.");
      }
    },
    onError: () => {
      setErrorMsg("Failed to delete the event.");
    }
  });

  const onFormSubmit = (data: EventPayload, isDraft = false) => {
    const finalDescription = editor ? JSON.stringify(editor.getJSON()) : data.description;
    const finalNotes = notesEditor && !notesEditor.isEmpty ? JSON.stringify(notesEditor.getJSON()) : data.meetingNotes;
    const payload = { ...data, description: finalDescription, meetingNotes: finalNotes, isDraft };
    if (editId) {
      updateMutation.mutate({ params: { id: editId }, body: payload });
    } else {
      saveMutation.mutate({ body: payload });
    }
  };

  const handleDelete = async () => {
    if (!editId) return;
    const confirmed = await modal.confirm({
      title: "Delete Event",
      description: "Are you sure you want to permanently delete this event?",
      confirmText: "Delete",
      destructive: true,
    });
    if (!confirmed) return;

    deleteMutation.mutate({ params: { id: editId }, body: {} });
  };

  const handleFileUpload = async (file: File) => {
    try {
      setUploadError("");
      const { url } = await uploadFile(file);
      setValue("coverImage", url);
    } catch(err) {
      setErrorMsg(String(err));
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-ares-red" size={32} /></div>;

  return (
    <div className="flex flex-col gap-6 w-full relative">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
          {editId ? "Edit Event" : "Publish Event"}
        </h2>
        <p className="text-white/60 text-sm">
          {editId ? "Update existing competition or outreach details." : "Add upcoming competitions or outreach events to the portal."}
        </p>
      </div>

      {isError && (
        <div className="bg-ares-red/10 border border-ares-red/30 p-4 ares-cut-sm text-ares-red text-xs font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
          COMMUNICATION FAULT: Failed to retrieve record from server.
        </div>
      )}
      
      {isDeleted && (
        <div className="bg-ares-danger/10 border-l-4 border-ares-danger p-4 mb-6 flex items-start gap-3">
          <div className="text-ares-danger mt-0.5">⚠️</div>
          <div>
            <h4 className="text-white font-bold text-sm tracking-wide uppercase">Ghost Event</h4>
            <p className="text-white text-sm mt-1 font-bold">This event is currently soft-deleted and is hidden from the public API and Google Calendar.</p>
          </div>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row gap-4 mt-2">
        <div className="flex-1">
          <label htmlFor="event-title" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Event Title *</label>
          <input
            id="event-title" type="text"
            {...register("title")}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner"
            placeholder="State Championship"
          />
          {errors.title && <p className="text-[10px] font-black uppercase text-ares-red mt-1">{errors.title.message}</p>}
        </div>
        <div className="flex-1">
          <CoverAssetPicker 
            coverImage={formValues.coverImage || DEFAULT_COVER_IMAGE}
            isUploading={isUploading}
            onUrlChange={(url) => setValue("coverImage", url)}
            onLibraryClick={() => setIsCoverPickerOpen(true)}
            onFileChange={handleFileUpload}
          />
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="event-category" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Category *</label>
          <select
            id="event-category"
            {...register("category")}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner appearance-none"
          >
            <option value="internal">ARES Practices</option>
            <option value="outreach">ARES Outreach &amp; Volunteer</option>
            <option value="external">ARES Community Spotlight</option>
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="event-tba-key" className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>TBA Event Key</span>
            <span className="text-xs text-white/60 font-normal normal-case">Optional</span>
          </label>
          <input
            id="event-tba-key" type="text"
            {...register("tbaEventKey")}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner"
            placeholder="e.g. 2024wvcmp"
          />
        </div>
        <div className="flex-1">
          <SeasonPicker value={formValues.seasonId || ""} onChange={(val) => setValue("seasonId", val)} />
        </div>
        <div className="flex-1">
          <label htmlFor="event-location" className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Location</span>
            <span className="text-xs text-white/60 font-normal normal-case">Pick from registry</span>
          </label>
          <div className="relative group">
            <select
              id="event-location"
              {...register("location")}
              className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner appearance-none pr-10"
            >
              <option value="">-- Select a Venue --</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.name}>
                  {loc.name} ({loc.address})
                </option>
              ))}
              <option value="CUSTOM">--- Manual Entry / New Venue ---</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/60 group-hover:text-ares-red transition-colors">
              <MapPin size={16} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="event-start" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Start Date & Time *</label>
          <input
            id="event-start" type="datetime-local"
            {...register("dateStart")}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
          />
          {errors.dateStart && <p className="text-[10px] font-black uppercase text-ares-red mt-1">{errors.dateStart.message}</p>}
        </div>
        <div className="flex-1">
          <label htmlFor="event-end" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">End Date & Time</label>
          <input
            id="event-end" type="datetime-local"
            {...register("dateEnd")}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="event-published-at" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Schedule Publish Time</label>
          <input
            id="event-published-at" type="datetime-local"
            {...register("publishedAt")}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
      </div>

      <EventPotluckVolunteerFlags 
        isPotluck={formValues.isPotluck || false} 
        isVolunteer={formValues.isVolunteer || false} 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onChange={(field, val) => setValue(field as any, val)}
      />

      <div>
        <label htmlFor="event-desc-editor" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Event Description / Recap</label>
        {editor && <RichEditorToolbar editor={editor} documentTitle={formValues.title || ""} />}
      </div>

      <div className="mt-4">
        <label htmlFor="event-notes-editor" className="flex items-center gap-2 text-xs font-bold text-ares-red uppercase tracking-wider mb-2">
          <span>🔒 Private Meeting Notes</span>
          <span className="text-white/60 font-normal normal-case">(verified members only)</span>
        </label>
        {notesEditor && <RichEditorToolbar editor={notesEditor} documentTitle={(formValues.title || "") + " Notes"} />}
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {errorMsg && (
          <div className="p-4 bg-ares-danger/10 border border-ares-danger/20 ares-cut flex items-start gap-3">
            <div className="text-ares-danger mt-0.5">⚠️</div>
            <div>
              <h4 className="text-white font-bold text-xs tracking-wide uppercase">Critical Error</h4>
              <p id="event-error-msg" className="text-white text-sm mt-1 font-bold">{errorMsg}</p>
            </div>
          </div>
        )}

        <EditorFooter 
          errorMsg={errorMsg}
          isPending={saveMutation.isPending}
          isEditing={!!editId}
          onDelete={handleDelete}
          onSaveDraft={handleSubmit((d) => onFormSubmit(d as EventPayload, true))}
          onPublish={handleSubmit((d) => onFormSubmit(d as EventPayload, false))}
          deleteText="DELETE"
          updateText="UPDATE EVENT"
          publishText={userRole === "author" ? "SUBMIT FOR REVIEW" : "PUBLISH EVENT"}
          userRole={userRole}
          roundedClass="ares-cut"
          extraControls={
            <SocialSyndicationGrid 
              availableSocials={availableSocials}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              socials={socials as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onChange={(platform, val) => setValue(`socials.${platform}` as any, val)}
              isEdit={!!editId}
            />
          }
        />
      </div>

      <AssetPickerModal 
        isOpen={isCoverPickerOpen}
        onClose={() => setIsCoverPickerOpen(false)}
        onSelect={(url) => {
          setValue("coverImage", url);
          setIsCoverPickerOpen(false);
        }}
      />
    </div>
  );
}

