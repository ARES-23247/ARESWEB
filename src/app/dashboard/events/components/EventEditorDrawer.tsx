"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { 
  Trash2, 
  X, 
  Maximize2, 
  Minimize2, 
  Sparkles, 
  AlertCircle, 
  RotateCcw
} from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import PhotoPickerModal from "@/components/PhotoPickerModal";
import EventGalleryTab from "./EventGalleryTab";
import EventRevisionsTab from "./EventRevisionsTab";
import LocationManagerModal, { TeamLocation } from "./LocationManagerModal";
import ShiftScheduleEditor from "./ShiftScheduleEditor";
import EventFormRoster from "./EventFormRoster";
import EventEditorAiCopilot from "./EventEditorAiCopilot";
import AccessibleTabs, { tabElementId, tabPanelId } from "@/components/AccessibleTabs";

import { TeamEvent } from "@/types/event";
import { useEventEditor, EventRevision, EventSignup, EventPhoto } from "../hooks/useEventEditor";

export type { TeamEvent, EventRevision, EventSignup, EventPhoto };

interface EventEditorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit: TeamEvent | null;
  locations: TeamLocation[];
  setLocations: React.Dispatch<React.SetStateAction<TeamLocation[]>>;
  teamMembers: { uid: string; nickname: string; avatar: string; }[];
}

export default function EventEditorDrawer({
  isOpen,
  onClose,
  eventToEdit,
  locations,
  setLocations,
  teamMembers
}: EventEditorDrawerProps) {
  const {
    formTitle,
    setFormTitle,
    formDateStart,
    setFormDateStart,
    formDateEnd,
    setFormDateEnd,
    formLocationId,
    setFormLocationId,
    formDescription,
    setFormDescription,
    formCategory,
    setFormCategory,
    formCoverImage,
    setFormCoverImage,
    formIsPotluck,
    setFormIsPotluck,
    formIsVolunteer,
    setFormIsVolunteer,
    formStatus,
    setFormStatus,
    isFullScreen,
    setIsFullScreen,
    activeTab,
    setActiveTab,
    showAiSidebar,
    setShowAiSidebar,
    revertAlert,
    setRevertAlert,
    isLocationModalOpen,
    setIsLocationModalOpen,
    signups,
    photos,
    revisions,
    loadingRevisions,
    operationError,
    isSaving,
    uploadingImage,
    uploadError,
    selectedPhoto,
    setSelectedPhoto,
    isPhotoPickerOpen,
    setIsPhotoPickerOpen,
    userNickname,
    currentUser,
    editId,
    canEdit,
    isAdmin,
    canPublishDirectly,
    displayedMembers,
    handleSaveEvent,
    handleDeleteEvent,
    handleRestoreEvent,
    handleRevertToRevision,
    handleImageUpload,
    handleDeletePhoto,
  } = useEventEditor({
    isOpen,
    onClose,
    eventToEdit,
    locations,
    setLocations,
    teamMembers
  });

  const [pendingLifecycle, setPendingLifecycle] = useState<"archive" | "restore" | null>(null);
  const hasNestedDialog = selectedPhoto !== null || isPhotoPickerOpen || isLocationModalOpen || pendingLifecycle !== null;
  const editorRef = useFocusTrap(isOpen && !hasNestedDialog, onClose);
  const eventTabs = editId
    ? ([
        { value: "edit", label: "✏️ Edit Event" },
        { value: "roster", label: "👥 Roster & RSVPs" },
        { value: "photos", label: "🖼️ Gallery" },
        { value: "revisions", label: "📜 Revisions" },
      ] as const)
    : ([{ value: "edit", label: "✏️ Edit Event" }] as const);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-end">
      {/* Backdrop */}
      <button type="button" className="absolute inset-0 h-full w-full bg-black/80 backdrop-blur-sm cursor-pointer" onClick={onClose} aria-label="Close event editor" />

      {/* Editor Drawer */}
      <div
        ref={editorRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={editId ? `Edit Event: ${formTitle}` : "Schedule Team Operation"}
        className={`relative z-10 h-full bg-obsidian border-l border-white/10 flex flex-col justify-between shadow-2xl focus:outline-none transition-all duration-300 motion-reduce:transition-none ${
          isFullScreen ? "w-full max-w-full" : "w-full max-w-5xl"
        }`}
      >
        <header className="px-6 py-4.5 border-b border-white/10 flex items-center justify-between bg-black/20 shrink-0">
          <div>
            <h3 className="text-white font-extrabold text-lg font-heading uppercase tracking-tight">
              {editId ? `Edit Event: ${formTitle}` : "Schedule Team Operation"}
            </h3>
            <p className="text-[10px] text-marble/60 uppercase font-bold mt-0.5">
              Published events appear on the public calendar
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
              title={isFullScreen ? "Minimize Editor" : "Maximize Editor"}
            >
              {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
              aria-label="Close editor"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Sub-Header: Tabs Switcher */}
        <div className="px-4 sm:px-6 border-b border-white/5 bg-black/10 flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center text-xs font-bold uppercase tracking-wider shrink-0 select-none text-left">
          <AccessibleTabs
            id="event-editor"
            label="Event editor sections"
            tabs={eventTabs}
            activeTab={activeTab}
            onChange={setActiveTab}
            className="flex gap-4 overflow-x-auto"
            tabClassName={(_value, active) => `py-3 border-b-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${active ? "border-ares-gold text-white" : "border-transparent text-marble/40 hover:text-white"}`}
          />

          {activeTab === "edit" && isAdmin && (
            <button
              type="button"
              onClick={() => setShowAiSidebar(!showAiSidebar)}
              className={`py-1.5 px-3 border rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-[10px] ${
                showAiSidebar
                  ? "border-ares-gold/30 bg-ares-gold/10 text-ares-gold"
                  : "border-white/10 hover:border-white/25 text-marble/60 hover:text-white"
              }`}
            >
              <Sparkles size={11} />
              {showAiSidebar ? "Hide AI Copilot" : "Show AI Copilot"}
            </button>
          )}
        </div>

        {/* Revert Alert banner */}
        {revertAlert && activeTab === "edit" && (
          <div className="px-6 py-3.5 bg-ares-gold/10 border-b border-ares-gold/20 text-ares-gold text-xs font-semibold flex items-center justify-between shrink-0 text-left">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{revertAlert}</span>
            </div>
            <button
              onClick={() => setRevertAlert(null)}
              className="text-ares-gold hover:text-white cursor-pointer font-bold text-[10px] uppercase"
            >
              Dismiss
            </button>
          </div>
        )}

        {operationError && (
          <div role="alert" className="border-b border-ares-red/45 bg-ares-red/15 px-6 py-3 text-white">
            <p className="text-[10px] font-bold">The calendar operation was not completed.</p>
            <p className="mt-1 break-words font-mono text-[9px] text-white/80">{operationError}</p>
          </div>
        )}

        {/* Content canvas - changes depending on active tab */}
        <div className="flex-1 overflow-hidden bg-black/10 p-6 flex flex-col">
          {/* Tab 1: EDIT FORM */}
          {activeTab === "edit" && (
            <div id={tabPanelId("event-editor", "edit")} role="tabpanel" aria-labelledby={tabElementId("event-editor", "edit")} tabIndex={0} className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
              <form
                onSubmit={handleSaveEvent}
                className={`space-y-6 flex-grow overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5 transition-all duration-300 ${
                  showAiSidebar ? "w-full lg:max-w-[68%]" : "w-full"
                }`}
              >
                <ShiftScheduleEditor
                  formTitle={formTitle}
                  setFormTitle={setFormTitle}
                  formDateStart={formDateStart}
                  setFormDateStart={setFormDateStart}
                  formDateEnd={formDateEnd}
                  setFormDateEnd={setFormDateEnd}
                  formLocationId={formLocationId}
                  setFormLocationId={setFormLocationId}
                  formDescription={formDescription}
                  setFormDescription={setFormDescription}
                  formCategory={formCategory}
                  setFormCategory={setFormCategory}
                  formCoverImage={formCoverImage}
                  setFormCoverImage={setFormCoverImage}
                  formIsPotluck={formIsPotluck}
                  setFormIsPotluck={setFormIsPotluck}
                  formIsVolunteer={formIsVolunteer}
                  setFormIsVolunteer={setFormIsVolunteer}
                  formStatus={formStatus}
                  setFormStatus={setFormStatus}
                  locations={locations}
                  canEdit={canEdit}
                  canPublishDirectly={canPublishDirectly}
                  setIsLocationModalOpen={setIsLocationModalOpen}
                  setIsPhotoPickerOpen={setIsPhotoPickerOpen}
                />

                <div className="pt-4 border-t border-white/5 flex justify-between gap-2 shrink-0">
                  <div className="flex flex-wrap gap-2">
                    {editId && canPublishDirectly && (
                      eventToEdit?.isDeleted === 1 ? (
                        <button
                            type="button"
                            onClick={() => setPendingLifecycle("restore")}
                            className="px-5 py-3 border border-ares-gold/35 hover:bg-ares-gold/10 text-ares-gold rounded text-xs uppercase font-black tracking-widest cursor-pointer transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                          >
                            <RotateCcw size={14} />
                            Restore Event
                          </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingLifecycle("archive")}
                          className="px-5 py-3 border border-ares-red/35 hover:bg-ares-red/10 text-white rounded text-xs uppercase font-black tracking-widest cursor-pointer transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                        >
                          <Trash2 size={14} />
                          Archive Event
                        </button>
                      )
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-3 border border-white/10 hover:bg-white/5 text-marble/70 hover:text-white rounded text-xs uppercase font-black tracking-widest cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                    {canEdit && (
                      <button
                        type="submit"
                        disabled={isSaving || !formTitle.trim() || !formDateStart}
                        className="px-6 py-3 bg-ares-red text-white hover:bg-ares-bronze font-black uppercase tracking-widest text-xs rounded transition-all shadow-md focus:ring-2 focus:ring-ares-cyan cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSaving ? "Saving…" : editId ? "Save Changes" : "Create Event"}
                      </button>
                    )}
                  </div>
                </div>
              </form>

              {/* SIDE AI PANEL */}
              {showAiSidebar && isAdmin && (
                <EventEditorAiCopilot
                  formTitle={formTitle}
                  formDescription={formDescription}
                  setFormDescription={setFormDescription}
                  formLocationId={formLocationId}
                  locations={locations}
                  setRevertAlert={setRevertAlert}
                />
              )}
            </div>
          )}

          {/* Tab 2: ROSTER & RSVPS */}
          {activeTab === "roster" && editId && (
            <div id={tabPanelId("event-editor", "roster")} role="tabpanel" aria-labelledby={tabElementId("event-editor", "roster")} tabIndex={0} className="flex-1 overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
              <EventFormRoster
                editId={editId}
                signups={signups}
                isAdmin={isAdmin}
                formIsPotluck={formIsPotluck}
                formIsVolunteer={formIsVolunteer}
                user={currentUser}
                userNickname={userNickname}
                teamMembers={teamMembers}
                displayedMembers={displayedMembers}
                setRevertAlert={setRevertAlert}
              />
            </div>
          )}

          {/* Tab 3: GALLERY */}
          {activeTab === "photos" && editId && (
            <div id={tabPanelId("event-editor", "photos")} role="tabpanel" aria-labelledby={tabElementId("event-editor", "photos")} tabIndex={0} className="flex-1 overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
              <EventGalleryTab
                photos={photos}
                canEdit={canEdit}
                uploadingImage={uploadingImage}
                uploadError={uploadError}
                handleImageUpload={handleImageUpload}
                handleDeletePhoto={handleDeletePhoto}
                setSelectedPhoto={setSelectedPhoto}
              />
            </div>
          )}

          {/* Tab 4: REVISIONS */}
          {activeTab === "revisions" && editId && (
            <div id={tabPanelId("event-editor", "revisions")} role="tabpanel" aria-labelledby={tabElementId("event-editor", "revisions")} tabIndex={0} className="flex-1 overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
              <EventRevisionsTab
                revisions={revisions}
                loadingRevisions={loadingRevisions}
                handleRevertToRevision={handleRevertToRevision}
              />
            </div>
          )}
        </div>
      </div>

      {/* Lightbox / Selected Photo Modal overlay */}
      {selectedPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-photo-title"
          onKeyDown={(event) => event.key === "Escape" && setSelectedPhoto(null)}
          className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center p-4"
        >
          <h4 id="event-photo-title" className="sr-only">Event photo: {selectedPhoto.filename}</h4>
          <button
            type="button"
            autoFocus
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-full transition-colors cursor-pointer"
            aria-label="Close Lightbox"
          >
            <X aria-hidden="true" size={18} />
          </button>
          <div className="max-w-4xl max-h-[85vh] flex flex-col gap-3">
            <img
              src={selectedPhoto.url}
              alt="Enlarged gallery item"
              className="max-h-[80vh] w-auto object-contain rounded-lg border border-white/5 shadow-2xl"
            />
            <div className="flex justify-between items-center text-[9px] font-mono text-marble/55 uppercase">
              <span>{selectedPhoto.filename}</span>
              <span>
                By {selectedPhoto.uploadedBy} ● {new Date(selectedPhoto.uploadedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Google Photo Picker Modal overlay */}
      <PhotoPickerModal
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onSelect={(url) => setFormCoverImage(url)}
      />

      {/* Locations Manager Modal overlay */}
      <LocationManagerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        locations={locations}
        setLocations={setLocations}
        formLocationId={formLocationId}
        setFormLocationId={setFormLocationId}
      />

      <Dialog.Root open={pendingLifecycle !== null} onOpenChange={(open) => !open && setPendingLifecycle(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/85" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[151] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/15 bg-obsidian p-6 shadow-2xl focus:outline-none">
            <Dialog.Title className="text-lg font-black uppercase text-white">
              {pendingLifecycle === "archive" ? "Archive this event?" : "Restore this event?"}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-marble/75">
              {pendingLifecycle === "archive"
                ? "The event will leave the public calendar. Managers can restore it later."
                : "The event will return as a draft. Review it before publishing."}
            </Dialog.Description>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <button type="button" className="rounded border border-white/15 px-4 py-2 text-xs font-black uppercase text-marble/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">Cancel</button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => {
                  const action = pendingLifecycle === "archive" ? handleDeleteEvent : handleRestoreEvent;
                  setPendingLifecycle(null);
                  void action();
                }}
                className="rounded bg-ares-red px-4 py-2 text-xs font-black uppercase text-white hover:bg-ares-bronze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                {pendingLifecycle === "archive" ? "Archive event" : "Restore as draft"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>,
    document.body,
  );
}
