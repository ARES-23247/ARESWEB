import { useParams } from "react-router-dom";
import { useRichEditor } from "./editor/useRichEditor";
import RichEditorToolbar from "./editor/RichEditorToolbar";
import AssetPickerModal from "./AssetPickerModal";
import { MapPin } from "lucide-react";
import EventPotluckVolunteerFlags from "./events/EventPotluckVolunteerFlags";
import SocialSyndicationGrid from "./editor/SocialSyndicationGrid";
import CoverAssetPicker from "./editor/CoverAssetPicker";
import EditorFooter from "./editor/EditorFooter";
import { useEventEditor } from "../hooks/useEventEditor";

export default function EventEditor({ userRole }: { userRole?: string | unknown }) {
  const { editId } = useParams<{ editId?: string }>();
  const editor = useRichEditor({ placeholder: "<p>Describe your upcoming event or write a full recap here...</p>" });

  const {
    form,
    setForm,
    socials,
    setSocials,
    errorMsg,
    warningMsg,
    successMsg,
    isCoverPickerOpen,
    setIsCoverPickerOpen,
    isDeleted,
    locations,
    availableSocials,
    isUploading,
    isPending,
    handleFileUpload,
    handleDelete,
    handlePublish,
  } = useEventEditor(editId, editor, userRole);

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
      
      {isDeleted && (
        <div className="bg-ares-danger/10 border-l-4 border-ares-danger p-4 rounded-r-lg mb-6 flex items-start gap-3">
          <div className="text-ares-danger mt-0.5">⚠️</div>
          <div>
            <h4 className="text-white font-bold text-sm tracking-wide uppercase">Ghost Event</h4>
            <p className="text-white text-sm mt-1 font-bold">This event is currently soft-deleted and is hidden from the public API and Google Calendar. Modifying and saving it will not undelete it.</p>
          </div>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row gap-4 mt-2">
        <div className="flex-1">
          <label htmlFor="event-title" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Event Title *</label>
          <input
            id="event-title" type="text"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/40 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner"
            placeholder="State Championship"
          />
        </div>
        <div className="flex-1">
          <CoverAssetPicker 
            coverImage={form.coverImage}
            isUploading={isUploading}
            onUrlChange={(url) => setForm({ ...form, coverImage: url })}
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
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/40 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner appearance-none"
          >
            <option value="internal">ARES Practices</option>
            <option value="outreach">ARES Outreach &amp; Volunteer</option>
            <option value="external">ARES Community Spotlight</option>
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="event-location" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Location</span>
            <span className="text-[10px] text-white/40 font-normal normal-case">Pick from registry</span>
          </label>
          <div className="relative group">
            <select
              id="event-location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/40 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner appearance-none pr-10"
            >
              <option value="">-- Select a Venue --</option>
              {locations.map(l => (
                <option key={l.id} value={l.address}>{l.name} ({l.address})</option>
              ))}
              <option value="CUSTOM">--- Manual Entry / New Venue ---</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/30 group-hover:text-ares-red transition-colors">
              <MapPin size={16} />
            </div>
          </div>
          
          {form.location === "CUSTOM" && (
             <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
               <input
                 type="text"
                 className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-2 text-white text-sm focus:border-ares-red outline-none"
                 placeholder="Enter custom location/address..."
                 onBlur={(e) => {
                   if (e.target.value.trim()) setForm({...form, location: e.target.value});
                 }}
               />
               <p className="text-[10px] text-white/40 mt-1 italic">Tip: Use the &apos;Location Manager&apos; tab to permanently save venues.</p>
             </div>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="event-start" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Start Date & Time *</label>
          <input
            id="event-start" type="datetime-local"
            value={form.dateStart} onChange={(e) => setForm({ ...form, dateStart: e.target.value })}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/40 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="event-end" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">End Date & Time</label>
          <input
            id="event-end" type="datetime-local"
            value={form.dateEnd} onChange={(e) => setForm({ ...form, dateEnd: e.target.value })}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/40 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="event-published-at" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Schedule Publish Time</label>
          <input
            id="event-published-at" type="datetime-local"
            value={form.publishedAt} onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
            className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/40 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
      </div>

      <EventPotluckVolunteerFlags 
        isPotluck={form.isPotluck} 
        isVolunteer={form.isVolunteer} 
        onChange={(field, val) => setForm({ ...form, [field]: val })}
      />

      <div>
        <label htmlFor="event-desc-editor" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Event Description / Recap</label>
        {editor && <RichEditorToolbar editor={editor} documentTitle={form.title} />}
      </div>



      <div className="mt-6 flex flex-col gap-4">
        {errorMsg && (
          <div className="p-4 bg-ares-danger/10 border border-ares-danger/20 ares-cut flex items-start gap-3">
            <div className="text-ares-danger mt-0.5">⚠️</div>
            <div>
              <h4 className="text-white font-bold text-xs tracking-wide uppercase">Critical Error</h4>
              <p className="text-white text-sm mt-1 font-bold">{errorMsg}</p>
            </div>
          </div>
        )}

        {warningMsg && (
          <div className="p-4 bg-ares-gold/10 border border-ares-gold/20 ares-cut flex items-start gap-3">
            <div className="text-ares-gold mt-0.5">⚠️</div>
            <div>
              <h4 className="text-ares-gold font-bold text-xs tracking-wide uppercase">Syndication Warning</h4>
              <p className="text-white/80 text-sm mt-1">Event saved, but: {warningMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-ares-gold/10 border border-ares-gold/20 ares-cut flex items-start gap-3">
            <div className="text-ares-gold mt-0.5">✅</div>
            <div>
              <h4 className="text-ares-gold font-bold text-xs tracking-wide uppercase">Success</h4>
              <p className="text-ares-gold/90 text-sm mt-1">{successMsg}</p>
            </div>
          </div>
        )}

        <EditorFooter 
          errorMsg={errorMsg}
          isPending={isPending}
          isEditing={!!editId}
          onDelete={handleDelete}
          onSaveDraft={() => handlePublish(true)}
          onPublish={() => handlePublish(false)}
          deleteText="DELETE"
          updateText="UPDATE EVENT"
          publishText={userRole === "author" ? "SUBMIT FOR REVIEW" : "PUBLISH EVENT"}
          userRole={userRole}
          roundedClass="ares-cut"
          extraControls={
            <SocialSyndicationGrid 
              availableSocials={availableSocials}
              socials={socials}
              onChange={(platform, val) => setSocials(prev => ({ ...prev, [platform]: val }))}
              isEdit={!!editId}
            />
          }
        />
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
