import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRichEditor } from "./editor/useRichEditor";
import RichEditorToolbar from "./editor/RichEditorToolbar";
import AssetPickerModal from "./AssetPickerModal";
import { compressImage } from "../utils/imageProcessor";
import { DEFAULT_COVER_IMAGE } from "../utils/constants";

export default function EventEditor({ editId, onClearEdit, userRole }: { editId?: string | null; onClearEdit?: () => void; userRole?: string | unknown }) {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
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

  const editor = useRichEditor({ placeholder: "<p>Describe your upcoming event or write a full recap here...</p>" });

  const [isDeleted, setIsDeleted] = useState(false);
  const [form, setForm] = useState({
    title: "",
    dateStart: "",
    dateEnd: "",
    location: "",
    description: "",
    coverImage: DEFAULT_COVER_IMAGE,
    isPotluck: false,
    isVolunteer: false,
  });

  const uploadFile = async (file: File): Promise<{url: string, altText?: string}> => {
    const { blob: compressedBlob, ext } = await compressImage(file);
    const formData = new FormData();
    formData.append("file", compressedBlob, file.name.replace(/\.[^/.]+$/, ext));
    const res = await fetch("/dashboard/api/admin/upload", { method: "POST", credentials: "include", body: formData });
    const data = await res.json();
    // @ts-expect-error -- D1 untyped response
    if (!data.url) throw new Error(data.error || "Upload failed");
    // @ts-expect-error -- D1 untyped response
    return { url: data.url, altText: data.altText };
  };

  useEffect(() => {
    if (!editId) return;
    const fetchEvent = async () => {
      try {
        const res = await fetch(`/api/admin/events/${editId}`);
        const data = await res.json();
      // @ts-expect-error -- D1 untyped response
        if (data.event) {
      // @ts-expect-error -- D1 untyped response
          setIsDeleted(data.event.is_deleted === 1);
          setForm({
      // @ts-expect-error -- D1 untyped response
            title: data.event.title || "",
      // @ts-expect-error -- D1 untyped response
            dateStart: data.event.date_start || "",
      // @ts-expect-error -- D1 untyped response
            dateEnd: data.event.date_end || "",
      // @ts-expect-error -- D1 untyped response
            location: data.event.location || "",
      // @ts-expect-error -- D1 untyped response
            description: data.event.description || "",
      // @ts-expect-error -- D1 untyped response
            coverImage: data.event.cover_image || DEFAULT_COVER_IMAGE,
      // @ts-expect-error -- D1 untyped response
            isPotluck: data.event.is_potluck === 1,
      // @ts-expect-error -- D1 untyped response
            isVolunteer: data.event.is_volunteer === 1,
          });
          if (editor) {
            try {
      // @ts-expect-error -- D1 untyped response
              editor.commands.setContent(JSON.parse(data.event.description));
            } catch {
      // @ts-expect-error -- D1 untyped response
              editor.commands.setContent(`<p>${data.event.description}</p>`);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load event for editing", err);
      }
    };
    fetchEvent();
  }, [editId, editor]);

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

  const handlePublish = async () => {
    if (!form.title || !form.dateStart) {
      setErrorMsg("Title and Start Date are required.");
      return;
    }

    setIsPending(true);
    setErrorMsg("");
    setWarningMsg("");
    setSuccessMsg("");

    try {
      const id = form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
      const finalDescription = editor ? JSON.stringify(editor.getJSON()) : form.description;
      const payload = { ...form, id, description: finalDescription };

      const method = editId ? "PUT" : "POST";
      const url = editId ? `/dashboard/api/admin/events/${editId}` : "/dashboard/api/admin/events";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...payload, socials }),
      });

      const data = await res.json();

      // @ts-expect-error -- D1 untyped response
      if (data.success) {
        setSuccessMsg(editId ? "Event updated successfully!" : "Event published successfully!");
        // Cloudflare D1 uses asynchronous replication to edge read-nodes. 
        // If social syndication resolves instantly (e.g. Bluesky is omitted),
        // we must wait for the D1 write to propagate before invalidating the React Query cache.
        queryClient.invalidateQueries({ queryKey: ["events"] });
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["events"] }), 1500);
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["events"] }), 3000);
        queryClient.invalidateQueries({ queryKey: ["admin_events"] });
        if (onClearEdit) onClearEdit();
        
      // @ts-expect-error -- D1 untyped response
        if (data.warning) {
      // @ts-expect-error -- D1 untyped response
          setWarningMsg(data.warning);
        }

        if (!editId) {
          setForm({ title: "", dateStart: "", dateEnd: "", location: "", description: "", coverImage: DEFAULT_COVER_IMAGE, isPotluck: false, isVolunteer: false });
        }
      } else {
      // @ts-expect-error -- D1 untyped response
        setErrorMsg(data.error || "Failed to publish event");
      }
    } catch {
      setErrorMsg("Network error — could not reach the API.");
    } finally {
      setIsPending(false);
    }
  };

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
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner"
            placeholder="State Championship"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="event-location" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Location</label>
          <input
            id="event-location" type="text"
            value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner"
            placeholder="Fairmont State University"
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="event-start" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Start Date & Time *</label>
          <input
            id="event-start" type="datetime-local"
            value={form.dateStart} onChange={(e) => setForm({ ...form, dateStart: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="event-end" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">End Date & Time</label>
          <input
            id="event-end" type="datetime-local"
            value={form.dateEnd} onChange={(e) => setForm({ ...form, dateEnd: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
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
        
        {/* ===== Unified Rich Editor ===== */}
        {editor && <RichEditorToolbar editor={editor} documentTitle={form.title} />}
      </div>

      <div>
        <label htmlFor="event-cover" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Cover Asset</label>
        <div className="flex gap-2">
          <input
            id="event-cover" type="text"
            value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner"
            placeholder={DEFAULT_COVER_IMAGE}
          />
          <button 
            className={`px-6 py-3 rounded-lg text-sm font-bold border border-zinc-700 transition-all focus:outline-none focus:ring-2 focus:ring-ares-red ring-offset-2 ring-offset-zinc-900 ${isUploading ? "bg-zinc-800 animate-pulse text-zinc-300" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"}`}
            onClick={() => document.getElementById('event-img-upload')?.click()}
          >
            UPL
          </button>
          <button 
            className="px-6 py-3 rounded-lg text-sm font-bold border border-ares-gold/30 transition-all focus:outline-none focus:ring-2 focus:ring-ares-gold ring-offset-2 ring-offset-zinc-900 bg-ares-gold/20 text-ares-gold hover:bg-ares-gold hover:text-black whitespace-nowrap"
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

      {/* Social Syndication Controls */}
      {availableSocials.length > 0 && (
        <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4 shadow-inner">
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
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
            <div className="text-red-500 mt-0.5">❌</div>
            <div>
              <h4 className="text-red-500 font-bold text-xs tracking-wide uppercase">Critical Error</h4>
              <p className="text-red-400/90 text-sm mt-1">{errorMsg}</p>
            </div>
          </div>
        )}

        {warningMsg && (
          <div className="p-4 bg-ares-gold/10 border border-ares-gold/20 rounded-2xl flex items-start gap-3">
            <div className="text-ares-gold mt-0.5">⚠️</div>
            <div>
              <h4 className="text-ares-gold font-bold text-xs tracking-wide uppercase">Syndication Warning</h4>
              <p className="text-zinc-300 text-sm mt-1">Event saved, but: {warningMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3">
            <div className="text-emerald-500 mt-0.5">✅</div>
            <div>
              <h4 className="text-emerald-500 font-bold text-xs tracking-wide uppercase">Success</h4>
              <p className="text-emerald-400/90 text-sm mt-1">{successMsg}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end pt-4 border-t border-zinc-800/50">
          <button
            onClick={handlePublish}
            disabled={isPending}
            className={`px-10 py-4 rounded-2xl font-black tracking-widest transition-all shadow-xl disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ares-red ring-offset-2 ring-offset-zinc-900
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
