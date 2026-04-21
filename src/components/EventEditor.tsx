import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRichEditor } from "./editor/useRichEditor";
import RichEditorToolbar from "./editor/RichEditorToolbar";
import AssetPickerModal from "./AssetPickerModal";
import { MapPin } from "lucide-react";
import { compressImage } from "../utils/imageProcessor";
import { DEFAULT_COVER_IMAGE } from "../utils/constants";

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
}

interface SyncResponse {
  success: boolean;
  id?: string;
  error?: string;
  warning?: string;
}

export default function EventEditor({ editId, onClearEdit, userRole }: { editId?: string | null; onClearEdit?: () => void; userRole?: string | unknown }) {
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState("");
  const [warningMsg, setWarningMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  const [socials, setSocials] = useState<Record<string, boolean>>({
    discord: true,
    bluesky: true,
    slack: false,
    teams: false,
    gchat: false,
    facebook: false,
    twitter: false,
    instagram: false
  });
  const [availableSocials, setAvailableSocials] = useState<string[]>([]);

  const { data: locations = [] } = useQuery<LocationRow[]>({
    queryKey: ["locations"],
    queryFn: async () => {
      const r = await fetch("/api/locations");
      if (!r.ok) return [];
      const d = await r.json() as { locations?: LocationRow[] };
      return d.locations || [];
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
  });
  
  const uploadFile = async (file: File): Promise<{url: string, altText?: string}> => {
    const { blob: compressedBlob, ext } = await compressImage(file);
    const formData = new FormData();
    formData.append("file", compressedBlob, file.name.replace(/\.[^/.]+$/, ext));
    const res = await fetch("/dashboard/api/admin/upload", { method: "POST", credentials: "include", body: formData });
    const data = await res.json() as { url?: string; altText?: string; error?: string };
    if (!data.url) throw new Error(data.error || "Upload failed");
    return { url: data.url, altText: data.altText };
  };

  // Fetch event data if editing
  useQuery({
    queryKey: ["event", editId],
    queryFn: async () => {
      if (!editId) return null;
      const res = await fetch(`/dashboard/api/admin/events/${editId}`, { credentials: "include" });
      const data = await res.json() as { event?: EventData };
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

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/dashboard/api/admin/settings", { credentials: "include" });
        const data = await res.json() as { success?: boolean; settings?: Record<string, string> };
        if (data.success && data.settings) {
          const config = data.settings;
          const available = [];
          if (config.DISCORD_WEBHOOK_URL) available.push("discord");
          if (config.BLUESKY_HANDLE && config.BLUESKY_APP_PASSWORD) available.push("bluesky");
          if (config.SLACK_WEBHOOK_URL) available.push("slack");
          if (config.TEAMS_WEBHOOK_URL) available.push("teams");
          if (config.GCHAT_WEBHOOK_URL) available.push("gchat");
          if (config.FACEBOOK_ACCESS_TOKEN) available.push("facebook");
          if (config.TWITTER_ACCESS_TOKEN) available.push("twitter");
          if (config.INSTAGRAM_ACCESS_TOKEN) available.push("instagram");
          setAvailableSocials(available);
        }
      } catch (err) {
        console.error("Failed to fetch available socials:", err);
      }
    };
    fetchSettings();
  }, []);

  const mutation = useMutation({
    mutationFn: async (isDraft: boolean) => {
      const finalDescription = editor ? JSON.stringify(editor.getJSON()) : form.description;
      const payload = { 
        ...form, 
        description: finalDescription, 
        isDraft,
        socials 
      };

      const method = editId ? "PUT" : "POST";
      const url = editId ? `/dashboard/api/admin/events/${editId}` : "/dashboard/api/admin/events";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok && res.status !== 207) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error || "Failed to save event");
      }

      return await res.json() as SyncResponse;
    },
    onSuccess: (data) => {
      if (data.success) {
        setSuccessMsg(editId ? "Event updated successfully!" : "Event published successfully!");
        setWarningMsg(data.warning || "");
        
        queryClient.invalidateQueries({ queryKey: ["events"] });
        queryClient.invalidateQueries({ queryKey: ["admin_events"] });
        
        // Multi-stage invalidation to account for D1 propagation delay
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["events"] }), 1500);

        if (onClearEdit) onClearEdit();

        if (!editId) {
          setForm({ 
            title: "", dateStart: "", dateEnd: "", location: "", 
            description: "", coverImage: DEFAULT_COVER_IMAGE, 
            category: "internal", isPotluck: false, isVolunteer: false 
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

  const handleDelete = async () => {
    if (!editId) return;
    const confirm = window.confirm("Are you sure you want to permanently delete this event?");
    if (!confirm) return;

    setErrorMsg("");
    setWarningMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/dashboard/api/events/admin/${editId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error("Failed to delete event.");
      }
      navigate("/dashboard");
    } catch {
      setErrorMsg("Failed to delete the event. Please try again.");
    }
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
        <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-lg mb-6 flex items-start gap-3">
          <div className="text-red-500 mt-0.5">⚠️</div>
          <div>
            <h4 className="text-red-500 font-bold text-sm tracking-wide uppercase">Ghost Event</h4>
            <p className="text-red-400/80 text-sm mt-1">This event is currently soft-deleted and is hidden from the public API and Google Calendar. Modifying and saving it will not undelete it.</p>
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
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={form.isPotluck}
              onChange={(e) => setForm({ ...form, isPotluck: e.target.checked })}
              className="w-5 h-5 rounded border-zinc-700 bg-zinc-950 text-ares-red focus:ring-ares-red transition-all cursor-pointer"
            />
            <span className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors uppercase tracking-wider">
              Potluck Event
            </span>
          </label>
          <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-tighter ml-7">
            Enable food sign-up sheet and dietary tracking.
          </p>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={form.isVolunteer}
              onChange={(e) => setForm({ ...form, isVolunteer: e.target.checked })}
              className="w-5 h-5 rounded border-zinc-700 bg-zinc-950 text-ares-red focus:ring-ares-red transition-all cursor-pointer"
            />
            <span className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors uppercase tracking-wider">
              Volunteer Opportunity
            </span>
          </label>
          <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-tighter ml-7">
            Automatically tracks prep and check-in hours for outreach.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="event-desc-editor" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Event Description / Recap</label>
        {editor && <RichEditorToolbar editor={editor} documentTitle={form.title} />}
      </div>

      <div>
        <label htmlFor="event-cover" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Cover Asset</label>
        <div className="flex gap-2">
          <input
            id="event-cover" type="text"
            value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-800 ares-cut-sm px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner"
            placeholder={DEFAULT_COVER_IMAGE}
          />
          <button 
            className={`px-6 py-3 ares-cut-sm text-sm font-bold border border-zinc-700 transition-all focus:outline-none focus:ring-2 focus:ring-ares-red ring-offset-2 ring-offset-zinc-900 ${isUploading ? "bg-zinc-800 animate-pulse text-zinc-300" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"}`}
            onClick={() => document.getElementById('event-img-upload')?.click()}
          >
            UPL
          </button>
          <button 
            className="px-6 py-3 ares-cut-sm text-sm font-bold border border-ares-gold/30 transition-all focus:outline-none focus:ring-2 focus:ring-ares-gold ring-offset-2 ring-offset-zinc-900 bg-ares-gold/20 text-ares-gold hover:bg-ares-gold hover:text-black whitespace-nowrap"
            onClick={() => setIsCoverPickerOpen(true)}
          >
            Library
          </button>
          <input 
            id="event-img-upload" type="file" accept="image/*,.heic,.heif" className="hidden" 
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setIsUploading(true);
              try {
                const { url } = await uploadFile(file);
                setForm({ ...form, coverImage: url });
              } catch(err) {
                setErrorMsg(String(err));
              } finally {
                setIsUploading(false);
              }
            }} 
          />
        </div>
      </div>

      {availableSocials.length > 0 && (
        <div className="bg-zinc-900/30 border border-zinc-800/50 ares-cut-sm p-4 shadow-inner">
          <div className="flex items-center gap-2 mb-3">
             <div className="w-2 h-2 rounded-full bg-ares-cyan animate-pulse"></div>
             <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Broadcast & Social Syndication</span>
          </div>
          <div className="flex flex-wrap gap-4">
            {availableSocials.map(platform => (
              <label key={platform} className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={socials[platform] || false}
                  onChange={(e) => setSocials(prev => ({ ...prev, [platform]: e.target.checked }))}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-ares-red focus:ring-ares-red transition-all cursor-pointer"
                />
                <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors capitalize">
                  {platform}
                </span>
              </label>
            ))}
          </div>
          <p className="text-[10px] text-zinc-500 mt-2 italic font-mono uppercase tracking-tighter">
            * Selected platforms will receive a preview card and link immediately upon {editId ? "updating" : "publication"}.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {errorMsg && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 ares-cut flex items-start gap-3">
            <div className="text-red-500 mt-0.5">❌</div>
            <div>
              <h4 className="text-red-500 font-bold text-xs tracking-wide uppercase">Critical Error</h4>
              <p className="text-red-400/90 text-sm mt-1">{errorMsg}</p>
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
