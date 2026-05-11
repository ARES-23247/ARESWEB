import { useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAdminSettings } from "../hooks/useAdminSettings";
import { useRichEditor } from "./editor/useRichEditor";
import RichEditorToolbar from "./editor/RichEditorToolbar";
import { CopilotMenu } from "./editor/CopilotMenu";
import AssetPickerModal from "./AssetPickerModal";
import { RefreshCw } from "lucide-react";
import EventPotluckVolunteerFlags from "./events/EventPotluckVolunteerFlags";
import SocialSyndicationGrid from "./editor/SocialSyndicationGrid";
import CoverAssetPicker from "./editor/CoverAssetPicker";
import EditorFooter from "./editor/EditorFooter";
import SeasonPicker from "./SeasonPicker";
import { useForm } from "@tanstack/react-form";
import { useImageUpload } from "../hooks/useImageUpload";
import { useModal } from "../contexts/ModalContext";
import { DEFAULT_coverImage } from "../utils/constants";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useGetAdminEventDetail, useSaveEvent, useUpdateEvent, useDeleteEvent, type Event } from "../api";

import { type Location } from "../api/locations";

import { CollaborativeEditorRoom, useCollaborativeEditor } from "./editor/CollaborativeEditorRoom";
import VersionHistorySidebar from "./editor/VersionHistorySidebar";
import ZulipThread from "./ZulipThread";
import { CreateLocationModal } from "./CreateLocationModal";
import { LocationCombobox } from "./LocationCombobox";

function EventEditorInner({ editId, userRole }: { editId?: string, userRole?: string, roomId?: string | null }) {
  const navigate = useNavigate();
  // const queryClient = useQueryClient(); // Reserved for future query invalidation
  const modal = useModal();
  
  const { ydoc, provider } = useCollaborativeEditor();
  const editor = useRichEditor({ 
    placeholder: "<p>Describe your upcoming event or write a full recap here...</p>",
    ydoc,
    provider,
    yfield: 'default'
  });
  

  const { availableSocials } = useAdminSettings();
  const { uploadFile, isUploading, setErrorMsg: setUploadError } = useImageUpload();

  const [isDeleted, setIsDeleted] = useState(false);
  const [isException, setIsException] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      title: "",
      dateStart: "",
      dateEnd: "",
      location: "",
      description: "",
      coverImage: DEFAULT_coverImage,
      category: "internal",
      tbaEventKey: "",
      isPotluck: false,
      isVolunteer: false,
      publishedAt: "",
      seasonId: undefined as number | undefined,
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
      },
      rrule: ""
    }
  });



  const [recurringGroupId, setRecurringGroupId] = useState<string | null>(null);
  const [updateMode, setUpdateMode] = useState<"single" | "following">("single");

  const [rruleFreq, setRruleFreq] = useState("");
  const [limitType, setLimitType] = useState<"none" | "count" | "date">("none");
  const [limitCount, setLimitCount] = useState("");
  const [limitDate, setLimitDate] = useState("");

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/locations");
        if (res.ok) {
          const data = (await res.json()) as { locations?: Location[] };
          return Array.isArray(data.locations) ? data.locations : [];
        }
        return [];
      } catch {
        return [];
      }
    }
  });

  // Use Hono client query for admin event detail
  const { data: eventRes, isLoading, isError } = useGetAdminEventDetail(editId || "", {
    enabled: !!editId
  });

  useEffect(() => {
    let active = true;
    const processEventData = async () => {
      await Promise.resolve();
      if (!active) return;
      
      if (eventRes?.event) {
        const event = eventRes.event as Event & { publishedAt?: string; socials?: Record<string, boolean> };
        const formatForInput = (d: string | null | undefined) => {
          if (!d) return "";
          if (d.length === 10) return d + "T00:00";
          return d.slice(0, 16).replace(" ", "T");
        };

        setIsDeleted(event.isDeleted === 1);
        setIsException(event.recurringException === 1);
        form.setFieldValue("title", event.title || "");
        form.setFieldValue("dateStart", formatForInput(event.dateStart));
        form.setFieldValue("dateEnd", formatForInput(event.dateEnd));
        form.setFieldValue("location", event.location || "");
        form.setFieldValue("description", event.description || "");
        form.setFieldValue("coverImage", event.coverImage || DEFAULT_coverImage);
        form.setFieldValue("category", (event.category || "internal") as "internal" | "outreach" | "external");
        form.setFieldValue("tbaEventKey", event.tbaEventKey || "");
        form.setFieldValue("isPotluck", event.isPotluck === 1);
        form.setFieldValue("isVolunteer", event.isVolunteer === 1);
        form.setFieldValue("publishedAt", event.publishedAt || "");
        form.setFieldValue("seasonId", event.seasonId ? Number(event.seasonId) : undefined);

        const defaultSocials: Record<string, boolean> = {
          discord: true,
          bluesky: true,
          slack: false,
          teams: false,
          gchat: false,
          facebook: false,
          twitter: false,
          instagram: false
        };
        const rawSocials = event.socials;
        const mergedSocials = {
          ...defaultSocials,
          ...(rawSocials && typeof rawSocials === 'object' && !Array.isArray(rawSocials) ? rawSocials : {})
        };
        form.setFieldValue("socials", mergedSocials);

        // Parse rrule
        let parsedFreq = "";
        let parsedLimitType: "none" | "count" | "date" = "none";
        let parsedLimitCount = "";
        let parsedLimitDate = "";

        if (event.rrule) {
          const parts = event.rrule.split(';');
          parts.forEach((p: string) => {
            if (p.startsWith('FREQ=')) parsedFreq = p;
            else if (p.startsWith('COUNT=')) { parsedLimitType = "count"; parsedLimitCount = p.substring(6); }
            else if (p.startsWith('UNTIL=')) { 
              parsedLimitType = "date"; 
              const dStr = p.substring(6); 
              if (dStr.length >= 8) parsedLimitDate = `${dStr.substring(0,4)}-${dStr.substring(4,6)}-${dStr.substring(6,8)}`;
            }
          });
        }
        setRruleFreq(parsedFreq);
        setLimitType(parsedLimitType);
        setLimitCount(parsedLimitCount);
        setLimitDate(parsedLimitDate);

        setRecurringGroupId(event.recurringGroupId || null);

        if (editor) {
          const shouldSetContent = !ydoc || ydoc.getXmlFragment("default").length === 0;
          if (shouldSetContent && event.description) {
            try {
              const parsed = JSON.parse(event.description);
              // Validate it's a proper Tiptap document with a content array
              if (parsed && typeof parsed === 'object' && Array.isArray(parsed.content)) {
                try {
                  editor.commands.setContent(parsed);
                } catch (renderErr) {
                  console.error("Tiptap render error on AST", renderErr);
                  editor.commands.setContent(`<p>${event.description}</p>`);
                }
              } else {
                // Valid JSON but not a Tiptap AST — render as HTML
                editor.commands.setContent(`<p>${event.description}</p>`);
              }
            } catch {
              editor.commands.setContent(`<p>${event.description}</p>`);
            }
          }
        }
      }
    };
    
    void processEventData();
    return () => { active = false; };

  }, [eventRes, form, editor, ydoc]);


  const saveMutation = useSaveEvent({
    onSuccess: (data: Record<string, unknown>) => {
      if (data.success) {
        toast.success("Event published!");
        if (data.warning) toast.info(data.warning as string);
        navigate({ to: "/dashboard" });
      } else {
        setErrorMsg("Event save failed.");
      }
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || "Network error.");
    }
  });

  const updateMutation = useUpdateEvent({
    onSuccess: (data: Record<string, unknown>) => {
      if (data.success) {
        toast.success("Event updated!");
        if (data.warning) toast.info(data.warning as string);
        navigate({ to: "/dashboard" });
      } else {
        setErrorMsg((data.error as string) || "Event update failed.");
      }
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || "Network error.");
    }
  });

  const deleteMutation = useDeleteEvent({
    onSuccess: () => {
      navigate({ to: "/dashboard/manage_event" });
    },
    onError: () => {
      setErrorMsg("Failed to delete the event.");
    }
  });

  const onFormSubmit = (isDraft = false) => {
    let finalRrule = rruleFreq;
    if (finalRrule && limitType === 'count' && limitCount) {
      finalRrule += `;COUNT=${limitCount}`;
    } else if (finalRrule && limitType === 'date' && limitDate) {
      finalRrule += `;UNTIL=${limitDate.replace(/-/g, '')}T000000Z`;
    }

    const formValue = form.state.values;
    const finalDescription = editor ? JSON.stringify(editor.getJSON()) : formValue.description;
    const payload = { ...formValue, description: finalDescription, meetingNotes: "", isDraft, updateMode, rrule: finalRrule };
    if (editId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateMutation.mutate({ id: editId, body: payload as any });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      saveMutation.mutate(payload as any);
    }
  };

  const handleDelete = async () => {
    if (!editId) return;
    
    let deleteMode: "single" | "following" = "single";
    if (recurringGroupId) {
      const confirmFollowing = await modal.confirm({
        title: "Delete Recurring Event",
        description: "This is a recurring event. Do you want to delete all following events in the series too?",
        confirmText: "Delete Following",
        cancelText: "Only This Event"
      });
      if (confirmFollowing) deleteMode = "following";
    } else {
      const confirmed = await modal.confirm({
        title: "Delete Event",
        description: "Are you sure you want to permanently delete this event?",
        confirmText: "Delete",
        destructive: true,
      });
      if (!confirmed) return;
    }

    deleteMutation.mutate({ id: editId, deleteMode });
  };

  const handleFileUpload = async (file: File) => {
    try {
      setUploadError("");
      const { url } = await uploadFile(file);
      form.setFieldValue("coverImage", url);
    } catch(err) {
      setErrorMsg(String(err));
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-ares-red" size={32} /></div>;

  return (

      <div className="flex flex-col gap-6 w-full relative h-full">
        <div>
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
      
      {isException && (
        <div className="bg-ares-gold/10 border-l-4 border-ares-gold p-4 mb-6 flex items-start gap-3">
          <div className="text-ares-gold mt-0.5">ℹ️</div>
          <div>
            <h4 className="text-white font-bold text-sm tracking-wide uppercase">Exception Instance</h4>
            <p className="text-white/80 text-sm mt-1 font-bold">This is a modified instance of a recurring series. Changes will only apply to this specific event.</p>
          </div>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row gap-4 mt-2">
        <div className="flex-1">
          <label htmlFor="event-title" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Event Title *</label>
          <form.Field name="title">
            {(field) => (
              <>
                <input
                  id="event-title" type="text"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner"
                  placeholder="State Championship"
                />
                {field.state.meta.errors.length > 0 && (
                  <>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <p className="text-[10px] font-black uppercase text-ares-red mt-1">{field.state.meta.errors[0] as any}</p>
                  </>
                )}
              </>
            )}
          </form.Field>
        </div>
        <div className="flex-1">
          <form.Subscribe selector={(s) => s.values.coverImage}>
            {(coverImage) => (
              <CoverAssetPicker
                coverImage={coverImage || DEFAULT_coverImage}
                isUploading={isUploading}
                onUrlChange={(url) => form.setFieldValue("coverImage", url as string)}
                onLibraryClick={() => setIsCoverPickerOpen(true)}
                onFileChange={handleFileUpload}
              />
            )}
          </form.Subscribe>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="event-category" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Category *</label>
          <form.Field name="category">
            {(field) => (
              <select
                id="event-category"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value as "internal" | "outreach" | "external")}
                className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner appearance-none"
              >
                <option value="internal">ARES Practices</option>
                <option value="outreach">ARES Outreach &amp; Volunteer</option>
                <option value="external">ARES Community Spotlight</option>
              </select>
            )}
          </form.Field>
        </div>
        <div className="flex-1">
          <label htmlFor="event-tba-key" className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>TBA Event Key</span>
            <span className="text-xs text-white/60 font-normal normal-case">Optional</span>
          </label>
          <form.Field name="tbaEventKey">
            {(field) => (
              <input
                id="event-tba-key" type="text"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner"
                placeholder="e.g. 2024wvcmp"
              />
            )}
          </form.Field>
        </div>
        <div className="flex-1">
          <form.Field name="seasonId">
            {(field) => (
              <SeasonPicker value={field.state.value || ""} onChange={(val) => field.handleChange(val ? Number(val) : undefined)} />
            )}
          </form.Field>
        </div>
        <div className="flex-1">
          <label htmlFor="event-location" className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Location</span>
            <span className="text-xs text-white/60 font-normal normal-case">Pick from registry</span>
          </label>
          <div className="relative group">
            <form.Field name="location">
              {(field) => (
                <LocationCombobox
                  id="event-location"
                  locations={locations}
                  value={field.state.value || ''}
                  onChange={(val) => field.handleChange(val)}
                  onCustomClick={() => setIsLocationModalOpen(true)}
                />
              )}
            </form.Field>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="event-start" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Start Date & Time *</label>
          <form.Field name="dateStart">
            {(field) => (
              <>
                <input
                  id="event-start" type="datetime-local"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
                />
                {field.state.meta.errors.length > 0 && (
                  <>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <p className="text-[10px] font-black uppercase text-ares-red mt-1">{field.state.meta.errors[0] as any}</p>
                  </>
                )}
              </>
            )}
          </form.Field>
        </div>
        <div className="flex-1">
          <label htmlFor="event-end" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">End Date & Time</label>
          <form.Field name="dateEnd">
            {(field) => (
              <input
                id="event-end" type="datetime-local"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
              />
            )}
          </form.Field>
        </div>
        <div className="flex-1">
          <label htmlFor="event-published-at" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Schedule Publish Time</label>
          <form.Field name="publishedAt">
            {(field) => (
              <input
                id="event-published-at" type="datetime-local"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
              />
            )}
          </form.Field>
        </div>
      </div>

      {!isException && (
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="event-rrule" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Repeats</label>
            <select
              id="event-rrule"
              value={rruleFreq}
              onChange={(e) => {
                setRruleFreq(e.target.value);
                if (!e.target.value) {
                  setLimitType("none");
                  setLimitCount("");
                  setLimitDate("");
                }
              }}
              className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner appearance-none"
            >
              <option value="">Never</option>
              <option value="FREQ=DAILY">Daily</option>
              <option value="FREQ=WEEKLY">Weekly</option>
              <option value="FREQ=MONTHLY">Monthly</option>
            </select>
          </div>
        </div>
      )}

      {!isException && rruleFreq && (
        <div className="flex flex-col md:flex-row gap-4 p-4 border border-white/10 bg-black/20 ares-cut-sm mb-4">
          <div className="flex-1">
            <label htmlFor="limitType" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Recurrence Limit</label>
            <select
              id="limitType"
              value={limitType}
              onChange={(e) => setLimitType(e.target.value as "none" | "count" | "date")}
              className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner appearance-none"
            >
              <option value="none">Forever (Max 52 instances)</option>
              <option value="count">End after X occurrences</option>
              <option value="date">End by specific date</option>
            </select>
          </div>
          
          {limitType === 'count' && (
            <div className="flex-1">
              <label htmlFor="limitCount" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Number of Occurrences</label>
              <input
                id="limitCount"
                type="number"
                min="1"
                max="52"
                value={limitCount}
                onChange={(e) => setLimitCount(e.target.value)}
                className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner"
                placeholder="e.g. 10"
              />
            </div>
          )}
          
          {limitType === 'date' && (
            <div className="flex-1">
              <label htmlFor="limitDate" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">End Date</label>
              <input
                id="limitDate"
                type="date"
                value={limitDate}
                onChange={(e) => setLimitDate(e.target.value)}
                className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
          )}
        </div>
      )}

      <EventPotluckVolunteerFlags
        isPotluck={form.state.values.isPotluck || false}
        isVolunteer={form.state.values.isVolunteer || false}
        onChange={(field, val) => form.setFieldValue(field as "isPotluck" | "isVolunteer", val)}
      />

      <div>
        <label htmlFor="event-desc-editor" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Event Description / Recap</label>
        {editor && (
          <div className="flex items-center gap-2">
             <div className="flex-1"><RichEditorToolbar editor={editor} documentTitle={form.state.values.title || ""} /></div>
          </div>
        )}
        {editor && <CopilotMenu editor={editor} />}
      </div>

       {editId && form.state.values.title && (
        <ZulipThread stream="events" topic={`Event: ${form.state.values.title}`} />
      )}

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

        {recurringGroupId && editId && !isException && (
          <div className="p-4 bg-obsidian border border-white/10 ares-cut flex items-center justify-between gap-4">
            <div>
              <h4 className="text-white font-bold text-sm tracking-wide">Recurring Event Options</h4>
              <p className="text-white/60 text-xs mt-1">This event is part of a series. Choose how your updates will be applied.</p>
            </div>
            <select
              value={updateMode}
              onChange={(e) => setUpdateMode(e.target.value as "single" | "following")}
              className="bg-black border border-white/20 ares-cut-sm px-4 py-2 text-white text-sm focus:border-ares-red focus:outline-none transition-all shadow-inner"
            >
              <option value="single">Only this instance</option>
              <option value="following">This and all following instances</option>
            </select>
          </div>
        )}

        <EditorFooter
          errorMsg={errorMsg}
          isPending={saveMutation.isPending}
          isEditing={!!editId}
          onDelete={handleDelete}
          onSaveDraft={() => onFormSubmit(true)}
          onPublish={() => onFormSubmit(false)}
          deleteText="DELETE"
          updateText="UPDATE EVENT"
          publishText={userRole === "author" ? "SUBMIT FOR REVIEW" : "PUBLISH EVENT"}
          userRole={userRole}
          roundedClass="ares-cut"
          onShowHistory={() => setIsHistoryOpen(true)}
          extraControls={
            <form.Subscribe selector={(s) => s.values.socials}>
              {(socials) => (
                <SocialSyndicationGrid
                  availableSocials={availableSocials}
                  socials={socials as Record<string, boolean>}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onChange={(platform, val) => form.setFieldValue(`socials.${platform}` as any, val)}
                  isEdit={!!editId}
                />
              )}
            </form.Subscribe>
          }
        />
      </div>

      <AssetPickerModal
        isOpen={isCoverPickerOpen}
        onClose={() => setIsCoverPickerOpen(false)}
        onSelect={(url) => {
          form.setFieldValue("coverImage", url);
          setIsCoverPickerOpen(false);
        }}
      />

      <CreateLocationModal
        isOpen={isLocationModalOpen}
        onClose={() => {
          setIsLocationModalOpen(false);
          // If they close without saving, reset dropdown to empty
          if (form.state.values.location === "CUSTOM") {
            form.setFieldValue("location", "");
          }
        }}
        onSuccess={(newName) => {
          setIsLocationModalOpen(false);
          // Add temporary option so it is immediately selectable before query refetch
          const selectEl = document.getElementById('event-location');
          if (selectEl instanceof HTMLSelectElement && !Array.from(selectEl.options).some(opt => opt.value === newName)) {
            const tempOpt = new Option(newName, newName);
            selectEl.add(tempOpt, selectEl.options[selectEl.options.length - 1]);
          }
          form.setFieldValue("location", newName);
        }}
      />

      {isHistoryOpen && editId && editor && (
        <VersionHistorySidebar
          roomId={`event_${editId}`}
          editor={editor}
          onClose={() => setIsHistoryOpen(false)}
          historyUrl={`/api/events/admin/${editId}/history`}
        />
      )}
      </div>
    </div>
  );
}

export default function EventEditor({ userRole }: { userRole?: string }) {
  const { editId } = useParams({ strict: false });

  const [draftId] = useState(() => `draft_event_${crypto.randomUUID?.() || Math.random().toString(36).substring(2)}`);
  const roomId = editId ? `event_${editId}` : draftId;

  return (
    <CollaborativeEditorRoom roomId={roomId}>
      <EventEditorInner editId={editId} userRole={userRole} roomId={roomId} />
    </CollaborativeEditorRoom>
  );
}



