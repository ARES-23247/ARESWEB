"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { Trash2, X, Maximize2, Minimize2, Sparkles, AlertCircle, RotateCcw } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import PhotoPickerModal from "@/components/PhotoPickerModal";
import EventGalleryTab from "./EventGalleryTab";
import EventRevisionsTab from "./EventRevisionsTab";
import LocationManagerModal, { TeamLocation } from "./LocationManagerModal";
import ShiftScheduleEditor from "./ShiftScheduleEditor";
import EventRecurrenceSection from "./EventRecurrenceSection";
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
  teamMembers: { uid: string; nickname: string; avatar: string }[];
}

export default function EventEditorDrawer({
  isOpen,
  onClose,
  eventToEdit,
  locations,
  setLocations,
  teamMembers,
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
    formRepeats,
    setFormRepeats,
    formInterval,
    setFormInterval,
    formByDay,
    setFormByDay,
    formUntil,
    setFormUntil,
    occurrenceExceptions,
    handleCancelOccurrence,
    handleRestoreOccurrence,
    occurrenceContextDate,
    editScope,
    handleEditScopeChange,
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
    teamMembers,
  });

  const [pendingLifecycle, setPendingLifecycle] = useState<"archive" | "restore" | null>(null);
  const hasNestedDialog =
    selectedPhoto !== null || isPhotoPickerOpen || isLocationModalOpen || pendingLifecycle !== null;
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
      <button
        type="button"
        className="absolute inset-0 h-full w-full bg-black/80 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
        aria-label="Close event editor"
      />

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
            tabClassName={(_value, active) =>
              `py-3 border-b-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${active ? "border-ares-gold text-white" : "border-transparent text-marble/40 hover:text-white"}`
            }
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
            <div
              id={tabPanelId("event-editor", "edit")}
              role="tabpanel"
              aria-labelledby={tabElementId("event-editor", "edit")}
              tabIndex={0}
              className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <form
                onSubmit={handleSaveEvent}
                className={`space-y-6 flex-grow overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5 transition-all duration-300 ${
                  showAiSidebar ? "w-full lg:max-w-[68%]" : "w-full"
                }`}
              >
                {occurrenceContextDate && (
                  <fieldset className="rounded-xl border border-ares-gold/25 bg-ares-gold/5 p-4">
                    <legend className="px-1 text-[10px] font-black uppercase tracking-widest text-ares-gold">
                      Edit repeating event
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label
                        className={`cursor-pointer rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-ares-cyan ${editScope === "occurrence" ? "border-ares-gold bg-ares-gold/10 text-white" : "border-white/10 text-marble/70"}`}
                      >
                        <input
                          type="radio"
                          name="event-edit-scope"
                          value="occurrence"
                          checked={editScope === "occurrence"}
                          onChange={() => handleEditScopeChange("occurrence")}
                          className="mr-2 accent-ares-gold"
                        />
                        <span className="text-xs font-black uppercase">This session</span>
                        <span className="mt-1 block pl-5 text-[10px] font-normal text-marble/70">
                          {new Date(`${occurrenceContextDate}T12:00:00`).toLocaleDateString(undefined, {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </label>
                      <label
                        className={`cursor-pointer rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-ares-cyan ${editScope === "series" ? "border-ares-gold bg-ares-gold/10 text-white" : "border-white/10 text-marble/70"}`}
                      >
                        <input
                          type="radio"
                          name="event-edit-scope"
                          value="series"
                          checked={editScope === "series"}
                          onChange={() => handleEditScopeChange("series")}
                          className="mr-2 accent-ares-gold"
                        />
                        <span className="text-xs font-black uppercase">Entire series</span>
                        <span className="mt-1 block pl-5 text-[10px] font-normal text-marble/70">
                          Changes every session in the schedule.
                        </span>
                      </label>
                    </div>
                  </fieldset>
                )}

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

                {editScope === "series" && (
                  <EventRecurrenceSection
                    canEdit={canEdit}
                    formDateStart={formDateStart}
                    formRepeats={formRepeats}
                    setFormRepeats={setFormRepeats}
                    formInterval={formInterval}
                    setFormInterval={setFormInterval}
                    formByDay={formByDay}
                    setFormByDay={setFormByDay}
                    formUntil={formUntil}
                    setFormUntil={setFormUntil}
                    isEditingExistingRecurring={Boolean(editId && eventToEdit?.recurrence)}
                    occurrenceExceptions={occurrenceExceptions}
                    onCancelOccurrence={handleCancelOccurrence}
                    onRestoreOccurrence={handleRestoreOccurrence}
                    suggestedSkipDate={occurrenceContextDate}
                  />
                )}

                <div className="pt-4 border-t border-white/5 flex justify-between gap-2 shrink-0">
                  <div className="flex flex-wrap gap-2">
                    {editId &&
                      canPublishDirectly &&
                      editScope === "series" &&
                      (eventToEdit?.isDeleted === 1 ? (
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
                      ))}
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
                        {isSaving
                          ? "Saving…"
                          : editId
                            ? editScope === "occurrence"
                              ? "Save This Session"
                              : "Save Series"
                            : "Create Event"}
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
            <div
              id={tabPanelId("event-editor", "roster")}
              role="tabpanel"
              aria-labelledby={tabElementId("event-editor", "roster")}
              tabIndex={0}
              className="flex-1 overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
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
            <div
              id={tabPanelId("event-editor", "photos")}
              role="tabpanel"
              aria-labelledby={tabElementId("event-editor", "photos")}
              tabIndex={0}
              className="flex-1 overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <EventGalleryTab
                photos={photos}
                canEdit={canEdit}
                uploadingImage={uploadingImage}
                uploadError={uploadError}
                handleImageUpload={handleImageUpload}
                handleDeletePhoto={handleDeletePhoto}
                setSelectedPhoto={setSelectedPhoto}
                occurrenceDate={occurrenceContextDate}
              />
            </div>
          )}

          {/* Tab 4: REVISIONS */}
          {activeTab === "revisions" && editId && (
            <div
              id={tabPanelId("event-editor", "revisions")}
              role="tabpanel"
              aria-labelledby={tabElementId("event-editor", "revisions")}
              tabIndex={0}
              className="flex-1 overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
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
      <Dialog.Root open={selectedPhoto !== null} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/95" />
          {selectedPhoto && (
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed left-1/2 top-1/2 z-[121] flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-lg border border-white/10 bg-black p-4 shadow-2xl focus:outline-none"
            >
              <Dialog.Title className="sr-only">Event photo: {selectedPhoto.filename}</Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/70 p-2 text-white transition-colors hover:bg-black focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  aria-label="Close lightbox"
                >
                  <X aria-hidden="true" size={18} />
                </button>
              </Dialog.Close>
              <img
                src={selectedPhoto.mediumUrl ?? selectedPhoto.url}
                alt={selectedPhoto.filename}
                className="max-h-[75vh] w-full object-contain rounded-lg"
              />
              <div className="flex flex-wrap justify-between gap-2 text-[9px] font-mono text-marble/65 uppercase">
                <span>{selectedPhoto.filename}</span>
                <span>
                  By {selectedPhoto.uploadedBy} ● {new Date(selectedPhoto.uploadedAt).toLocaleDateString()}
                </span>
              </div>
            </Dialog.Content>
          )}
        </Dialog.Portal>
      </Dialog.Root>

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
                <button
                  type="button"
                  className="rounded border border-white/15 px-4 py-2 text-xs font-black uppercase text-marble/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  Cancel
                </button>
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
