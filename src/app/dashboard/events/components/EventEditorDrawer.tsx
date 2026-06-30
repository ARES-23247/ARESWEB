"use client";

import React from "react";
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
    uploadingImage,
    uploadError,
    selectedPhoto,
    setSelectedPhoto,
    isPhotoPickerOpen,
    setIsPhotoPickerOpen,
    userNickname,
    editId,
    canEdit,
    isAdmin,
    canPublishDirectly,
    displayedMembers,
    handleSaveEvent,
    handleDeleteEvent,
    handleRestoreEvent,
    handlePermanentDeleteEvent,
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

  const editorRef = useFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer" onClick={onClose} />

      {/* Editor Drawer */}
      <div
        ref={editorRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={editId ? `Edit Event: ${formTitle}` : "Schedule Team Operation"}
        className={`relative z-10 h-full bg-obsidian border-l border-white/10 flex flex-col justify-between shadow-2xl focus:outline-none transition-all duration-300 ${
          isFullScreen ? "w-full max-w-full" : "w-full max-w-5xl"
        }`}
      >
        <header className="px-6 py-4.5 border-b border-white/10 flex items-center justify-between bg-black/20 shrink-0">
          <div>
            <h3 className="text-white font-extrabold text-lg font-heading uppercase tracking-tight">
              {editId ? `Edit Event: ${formTitle}` : "Schedule Team Operation"}
            </h3>
            <p className="text-[10px] text-marble/60 uppercase font-bold mt-0.5">
              Synchronizes with public roster grids
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
        <div className="px-6 border-b border-white/5 bg-black/10 flex justify-between items-center text-xs font-bold uppercase tracking-wider shrink-0 select-none text-left">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={`py-3 border-b-2 transition-all cursor-pointer ${
                activeTab === "edit"
                  ? "border-ares-gold text-white"
                  : "border-transparent text-marble/40 hover:text-white"
              }`}
            >
              ✏️ Edit Event
            </button>
            {editId && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab("roster")}
                  className={`py-3 border-b-2 transition-all cursor-pointer ${
                    activeTab === "roster"
                      ? "border-ares-gold text-white"
                      : "border-transparent text-marble/40 hover:text-white"
                  }`}
                >
                  👥 Roster & RSVPs
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("photos")}
                  className={`py-3 border-b-2 transition-all cursor-pointer ${
                    activeTab === "photos"
                      ? "border-ares-gold text-white"
                      : "border-transparent text-marble/40 hover:text-white"
                  }`}
                >
                  🖼️ Gallery
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("revisions")}
                  className={`py-3 border-b-2 transition-all cursor-pointer ${
                    activeTab === "revisions"
                      ? "border-ares-gold text-white"
                      : "border-transparent text-marble/40 hover:text-white"
                  }`}
                >
                  📜 Revisions
                </button>
              </>
            )}
          </div>

          {activeTab === "edit" && (
            <button
              type="button"
              onClick={() => setShowAiSidebar(!showAiSidebar)}
              className={`py-1.5 px-3 border rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-[10px] ${
                showAiSidebar
                  ? "border-ares-cyan/30 bg-ares-cyan/10 text-ares-cyan"
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

        {/* Content canvas - changes depending on active tab */}
        <div className="flex-1 overflow-hidden bg-black/10 p-6 flex flex-col">
          {/* Tab 1: EDIT FORM */}
          {activeTab === "edit" && (
            <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0">
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
                  <div className="flex gap-2">
                    {editId && canEdit && (
                      eventToEdit?.isDeleted === 1 ? (
                        <>
                          <button
                            type="button"
                            onClick={handleRestoreEvent}
                            className="px-5 py-3 border border-ares-success/35 hover:bg-ares-success/10 text-ares-success rounded text-xs uppercase font-black tracking-widest cursor-pointer transition-all flex items-center gap-2"
                          >
                            <RotateCcw size={14} />
                            Restore Event
                          </button>
                          {canPublishDirectly && (
                            <button
                              type="button"
                              onClick={handlePermanentDeleteEvent}
                              className="px-5 py-3 border border-ares-red/35 hover:bg-ares-red/10 text-ares-red-light rounded text-xs uppercase font-black tracking-widest cursor-pointer transition-all flex items-center gap-2"
                            >
                              <Trash2 size={14} />
                              Permanently Delete
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={handleDeleteEvent}
                          className="px-5 py-3 border border-ares-red/35 hover:bg-ares-red/10 text-ares-red-light rounded text-xs uppercase font-black tracking-widest cursor-pointer transition-all flex items-center gap-2"
                        >
                          <Trash2 size={14} />
                          Delete Event
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
                        className="px-6 py-3 bg-ares-red text-white hover:bg-ares-red-dark font-black uppercase tracking-widest text-xs rounded transition-all shadow-md focus:ring-2 focus:ring-ares-cyan cursor-pointer"
                      >
                        {editId ? "Save Changes" : "Create Event"}
                      </button>
                    )}
                  </div>
                </div>
              </form>

              {/* SIDE AI PANEL */}
              {showAiSidebar && (
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
            <EventFormRoster
              editId={editId}
              signups={signups}
              isAdmin={isAdmin}
              formIsPotluck={formIsPotluck}
              formIsVolunteer={formIsVolunteer}
              user={null}
              userNickname={userNickname}
              teamMembers={teamMembers}
              displayedMembers={displayedMembers}
              setRevertAlert={setRevertAlert}
            />
          )}

          {/* Tab 3: GALLERY */}
          {activeTab === "photos" && editId && (
            <EventGalleryTab
              photos={photos}
              canEdit={canEdit}
              uploadingImage={uploadingImage}
              uploadError={uploadError}
              handleImageUpload={handleImageUpload}
              handleDeletePhoto={handleDeletePhoto}
              setSelectedPhoto={setSelectedPhoto}
            />
          )}

          {/* Tab 4: REVISIONS */}
          {activeTab === "revisions" && editId && (
            <EventRevisionsTab
              revisions={revisions}
              loadingRevisions={loadingRevisions}
              handleRevertToRevision={handleRevertToRevision}
            />
          )}
        </div>
      </div>

      {/* Lightbox / Selected Photo Modal overlay */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center p-4">
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-full transition-colors cursor-pointer"
            aria-label="Close Lightbox"
          >
            <X size={18} />
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
    </div>
  );
}
