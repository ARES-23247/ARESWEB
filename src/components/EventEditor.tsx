import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRichEditor } from "./editor/useRichEditor";
import RichEditorToolbar from "./editor/RichEditorToolbar";
import AssetPickerModal from "./AssetPickerModal";
import { MapPin } from "lucide-react";
import { DEFAULT_COVER_IMAGE } from "../utils/constants";
import EventPotluckVolunteerFlags from "./events/EventPotluckVolunteerFlags";
import EventSocialSyndication from "./events/EventSocialSyndication";
import EventCoverPicker from "./events/EventCoverPicker";
import { useAdminSettings } from "../hooks/useAdminSettings";
import { useImageUpload } from "../hooks/useImageUpload";
import { eventSchema } from "../schemas/eventSchema";
import { adminApi } from "../api/adminApi";
import { publicApi } from "../api/publicApi";
import { useModal } from "../contexts/ModalContext";

interface LocationRow {
  id: string;
  name: string;
  address: string;
}

interface EventData {
  id: string;
  title: string;
  date_start: string;
  date_end: string;
  location: string;
  description: string;
  cover_image: string;
  category: string;
  is_potluck: number;
  is_volunteer: number;
  is_deleted: number;
  status: string;
  revision_of?: string;
  published_at?: string;
}


export default function EventEditor({ userRole }: { userRole?: string | unknown }) {
  const { editId } = useParams<{ editId?: string }>();
  const queryClient = useQueryClient();
  const modal = useModal();
  const [errorMsg, setErrorMsg] = useState("");
  const [warningMsg, setWarningMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  
  const [socials, setSocials] = useState<Record<string, boolean>>({
    discord: true, bluesky: true, slack: false, teams: false, gchat: false, facebook: false, twitter: false, instagram: false
  });

  // Custom Hooks
  const { availableSocials } = useAdminSettings();
  const { uploadFile, isUploading, errorMsg: uploadError, setErrorMsg: setUploadError } = useImageUpload();

  const { data: locations = [] } = useQuery<LocationRow[]>({
    queryKey: ["locations"],
    queryFn: async () => {
      try {
        const d = await publicApi.get<{ locations?: LocationRow[] }>("/api/locations");
        return d.locations || [];
      } catch {
        return [];
      }
    }
  });

  const editor = useRichEditor({ placeholder: "<p>Describe your upcoming event or write a full recap here...</p>" });

  const [isDeleted, setIsDeleted] = useState(false);
  const [form, setForm] = useState({
    title: "",
    dateStart: "",
    dateEnd: "",
    location: "",
    description: "",
    coverImage: DEFAULT_COVER_IMAGE,
    category: "internal",
    isPotluck: false,
    isVolunteer: false,
    publishedAt: "",
  });

  const handleFileUpload = async (file: File) => {
    try {
      setUploadError("");
      const { url } = await uploadFile(file);
      setForm({ ...form, coverImage: url });
    } catch(err) {
      setErrorMsg(uploadError || String(err));
    }
  };

  // Fetch event data if editing
  useQuery({
    queryKey: ["event", editId],
    queryFn: async () => {
      if (!editId) return null;
      const data = await adminApi.get<{ event?: EventData }>(`/api/admin/events/${editId}`);
      if (data.event) {
        setIsDeleted(data.event.is_deleted === 1);
        setForm({
          title: data.event.title || "",
          dateStart: data.event.date_start || "",
          dateEnd: data.event.date_end || "",
          location: data.event.location || "",
          description: data.event.description || "",
          coverImage: data.event.cover_image || DEFAULT_COVER_IMAGE,
          category: data.event.category || "internal",
          isPotluck: data.event.is_potluck === 1,
          isVolunteer: data.event.is_volunteer === 1,
          publishedAt: data.event.published_at || "",
        });
        if (editor) {
          try {
            editor.commands.setContent(JSON.parse(data.event.description));
          } catch {
            editor.commands.setContent(`<p>${data.event.description}</p>`);
          }
        }
      }
      return data.event;
    },
    enabled: !!editId && !!editor,
  });

  const mutation = useMutation({
    mutationFn: async (isDraft: boolean) => {
      const finalDescription = editor ? JSON.stringify(editor.getJSON()) : form.description;
      const payload = { 
        ...form, 
        description: finalDescription, 
        isDraft,
        socials 
      };

      const parsed = eventSchema.parse(payload);
      const data = editId
        ? await adminApi.updateEvent(editId, parsed)
        : await adminApi.createEvent(parsed);
        
      if (!data.success) throw new Error(data.error || "Event save failed.");
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        setSuccessMsg(editId ? "Event updated successfully!" : "Event published successfully!");
        setWarningMsg(data.warning || "");
        
        queryClient.invalidateQueries({ queryKey: ["events"] });
        queryClient.invalidateQueries({ queryKey: ["admin_events"] });
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["events"] }), 1500);

        if (!editId) {
          setForm({ 
            title: "", dateStart: "", dateEnd: "", location: "", 
            description: "", coverImage: DEFAULT_COVER_IMAGE, 
            category: "internal", isPotluck: false, isVolunteer: false, publishedAt: "" 
          });
          if (editor) editor.commands.clearContent();
        }
      } else {
        setErrorMsg(data.error || "Failed to publish event");
      }
    },
    onError: (err: unknown) => {
      setErrorMsg((err as Error).message || "Network error — could not reach the API.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const data = await adminApi.deleteEvent(id);
      if (!data.success) throw new Error(data.error || "Failed to delete event.");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["admin_events"] });
    },
    onError: () => {
      setErrorMsg("Failed to delete the event. Please try again.");
    }
  });

  const handleDelete = async () => {
    if (!editId) return;
    const confirmed = await modal.confirm({
      title: "Delete Event",
      description: "Are you sure you want to permanently delete this event?",
      confirmText: "Delete",
      destructive: true,
    });
    if (!confirmed) return;

    setErrorMsg("");
    setWarningMsg("");
    setSuccessMsg("");
    deleteMutation.mutate(editId);
  };

  const handlePublish = (isDraft: boolean = false) => {
    if (!form.title || !form.dateStart) {
      setErrorMsg("Title and Start Date are required.");
      return;
    }
    setErrorMsg("");
    setWarningMsg("");
    setSuccessMsg("");
    mutation.mutate(isDraft);
  };

  const isPending = mutation.isPending;

  return (
    <div className="flex flex-col gap-6 w-full relative">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
          {editId ? "Edit Event" : "Publish Event"}
        </h2>
        <p className="text-zinc-400 text-sm">
          {editId ? "Update existing competition or outreach details." : "Add upcoming competitions or outreach events to the portal."}
        </p>
      </div>
      
      {isDeleted && (
        <div className="bg-ares-danger/10 border-l-4 border-ares-danger p-4 rounded-r-lg mb-6 flex items-start gap-3">
          <div className="text-ares-danger mt-0.5">⚠️</div>
          <div>
            <h4 className="text-ares-danger font-bold text-sm tracking-wide uppercase">Ghost Event</h4>
            <p className="text-ares-danger-soft/80 text-sm mt-1">This event is currently soft-deleted and is hidden from the public API and Google Calendar. Modifying and saving it will not undelete it.</p>
          </div>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row gap-4 mt-2">
        <div className="flex-[2]">
          <label htmlFor="event-title" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Event Title *</label>
          <input
            id="event-title" type="text"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-800 ares-cut-sm px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner"
            placeholder="State Championship"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="event-category" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Category *</label>
          <select
            id="event-category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-800 ares-cut-sm px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner appearance-none"
          >
            <option value="internal">ARES Practices</option>
            <option value="outreach">ARES Outreach &amp; Volunteer</option>
            <option value="external">ARES Community Spotlight</option>
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="event-location" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Location</span>
            <span className="text-[10px] text-zinc-500 font-normal normal-case">Pick from registry</span>
          </label>
          <div className="relative group">
            <select
              id="event-location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 ares-cut-sm px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner appearance-none pr-10"
            >
              <option value="">-- Select a Venue --</option>
              {locations.map(l => (
                <option key={l.id} value={l.address}>{l.name} ({l.address})</option>
              ))}
              <option value="CUSTOM">--- Manual Entry / New Venue ---</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600 group-hover:text-ares-red transition-colors">
              <MapPin size={16} />
            </div>
          </div>
          
          {form.location === "CUSTOM" && (
             <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
               <input
                 type="text"
                 className="w-full bg-zinc-900 border border-zinc-800 ares-cut-sm px-4 py-2 text-zinc-100 text-sm focus:border-ares-red outline-none"
                 placeholder="Enter custom location/address..."
                 onBlur={(e) => {
                   if (e.target.value.trim()) setForm({...form, location: e.target.value});
                 }}
               />
               <p className="text-[10px] text-zinc-500 mt-1 italic">Tip: Use the &apos;Location Manager&apos; tab to permanently save venues.</p>
             </div>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="event-start" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Start Date & Time *</label>
          <input
            id="event-start" type="datetime-local"
            value={form.dateStart} onChange={(e) => setForm({ ...form, dateStart: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-800 ares-cut-sm px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="event-end" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">End Date & Time</label>
          <input
            id="event-end" type="datetime-local"
            value={form.dateEnd} onChange={(e) => setForm({ ...form, dateEnd: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-800 ares-cut-sm px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="event-published-at" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Schedule Publish Time</label>
          <input
            id="event-published-at" type="datetime-local"
            value={form.publishedAt} onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-800 ares-cut-sm px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
      </div>

      <EventPotluckVolunteerFlags 
        isPotluck={form.isPotluck} 
        isVolunteer={form.isVolunteer} 
        onChange={(field, val) => setForm({ ...form, [field]: val })}
      />

      <div>
        <label htmlFor="event-desc-editor" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Event Description / Recap</label>
        {editor && <RichEditorToolbar editor={editor} documentTitle={form.title} />}
      </div>

      <EventCoverPicker 
        coverImage={form.coverImage}
        isUploading={isUploading}
        onUrlChange={(url) => setForm({ ...form, coverImage: url })}
        onLibraryClick={() => setIsCoverPickerOpen(true)}
        onUploadClick={() => document.getElementById('event-img-upload')?.click()}
        onFileChange={handleFileUpload}
      />

      <EventSocialSyndication 
        availableSocials={availableSocials}
        socials={socials}
        onChange={(platform, val) => setSocials(prev => ({ ...prev, [platform]: val }))}
        isEdit={!!editId}
      />

      <div className="mt-6 flex flex-col gap-4">
        {errorMsg && (
          <div className="p-4 bg-ares-danger/10 border border-ares-danger/20 ares-cut flex items-start gap-3">
            <div className="text-ares-danger mt-0.5">⚠️</div>
            <div>
              <h4 className="text-ares-danger font-bold text-xs tracking-wide uppercase">Critical Error</h4>
              <p className="text-ares-danger-soft/90 text-sm mt-1">{errorMsg}</p>
            </div>
          </div>
        )}

        {warningMsg && (
          <div className="p-4 bg-ares-gold/10 border border-ares-gold/20 ares-cut flex items-start gap-3">
            <div className="text-ares-gold mt-0.5">⚠️</div>
            <div>
              <h4 className="text-ares-gold font-bold text-xs tracking-wide uppercase">Syndication Warning</h4>
              <p className="text-zinc-300 text-sm mt-1">Event saved, but: {warningMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 ares-cut flex items-start gap-3">
            <div className="text-emerald-500 mt-0.5">✅</div>
            <div>
              <h4 className="text-emerald-500 font-bold text-xs tracking-wide uppercase">Success</h4>
              <p className="text-emerald-400/90 text-sm mt-1">{successMsg}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end pt-4 border-t border-zinc-800/50 gap-4">
          {editId && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className={`px-8 py-4 ares-cut font-black tracking-widest transition-all shadow-xl disabled:opacity-50 border border-ares-red/30 bg-ares-red/10 text-ares-red hover:bg-ares-red hover:text-white mr-auto`}
            >
              DELETE
            </button>
          )}
          <button
            onClick={() => handlePublish(true)}
            disabled={isPending}
            className={`px-8 py-4 ares-cut font-black tracking-widest transition-all shadow-xl disabled:opacity-50 border border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800`}
          >
            {isPending ? "SAVING..." : "SAVE AS DRAFT"}
          </button>
          <button
            onClick={() => handlePublish(false)}
            disabled={isPending}
            className={`px-10 py-4 ares-cut font-black tracking-widest transition-all shadow-xl disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ares-red ring-offset-2 ring-offset-zinc-900
              ${isPending ? "bg-zinc-800 text-zinc-300 animate-pulse cursor-wait" : "bg-white text-zinc-950 hover:bg-ares-red hover:text-white hover:-translate-y-1 active:translate-y-0"}`}
          >
            {isPending ? "COMMITTING..." : editId ? "UPDATE EVENT" : (userRole === "author" ? "SUBMIT FOR REVIEW" : "PUBLISH EVENT")}
          </button>
        </div>
      </div>

      <AssetPickerModal 
        isOpen={isCoverPickerOpen}
        onClose={() => setIsCoverPickerOpen(false)}
        onSelect={(url) => {
          setForm({ ...form, coverImage: url });
          setIsCoverPickerOpen(false);
        }}
      />
    </div>
  );
}
