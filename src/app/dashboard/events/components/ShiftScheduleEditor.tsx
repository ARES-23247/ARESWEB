"use client";

import React from "react";
import { MapPin, Image as ImageIcon, X, Shield } from "lucide-react";
import { TeamLocation } from "./LocationManagerModal";
import MarkdownEditor from "@/components/MarkdownEditor";

interface ShiftScheduleEditorProps {
  formTitle: string;
  setFormTitle: (val: string) => void;
  formDateStart: string;
  setFormDateStart: (val: string) => void;
  formDateEnd: string;
  setFormDateEnd: (val: string) => void;
  formLocationId: string;
  setFormLocationId: (val: string) => void;
  formDescription: string;
  setFormDescription: (val: string) => void;
  formCategory: "internal" | "outreach";
  setFormCategory: (val: "internal" | "outreach") => void;
  formCoverImage: string;
  setFormCoverImage: (val: string) => void;
  formIsPotluck: number;
  setFormIsPotluck: (val: number) => void;
  formIsVolunteer: number;
  setFormIsVolunteer: (val: number) => void;
  formStatus: "published" | "pending" | "draft";
  setFormStatus: (val: "published" | "pending" | "draft") => void;
  locations: TeamLocation[];
  canEdit: boolean;
  canPublishDirectly: boolean;
  setIsLocationModalOpen: (val: boolean) => void;
  setIsPhotoPickerOpen: (val: boolean) => void;
}

const getSafeImageUrl = (url: string) => {
  if (!url) return "";
  const trimmed = url.trim();
  if (trimmed.toLowerCase().startsWith("javascript:")) {
    return "";
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("data:image/") || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return "";
};

export default function ShiftScheduleEditor({
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
  locations,
  canEdit,
  canPublishDirectly,
  setIsLocationModalOpen,
  setIsPhotoPickerOpen,
}: ShiftScheduleEditorProps) {
  return (
    <div className="space-y-6 text-left">
      <div>
        <label
          htmlFor="event-title"
          className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
        >
          Event Title
        </label>
        <input
          id="event-title"
          type="text"
          placeholder="e.g. Sunday Night EKF Odometry Calibrations"
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
          className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
          required
          disabled={!canEdit}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="event-start"
            className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
          >
            Start Date & Time
          </label>
          <input
            id="event-start"
            type="datetime-local"
            value={formDateStart}
            onChange={(e) => setFormDateStart(e.target.value)}
            className="w-full bg-black/60 border border-white/10 text-marble/95 text-xs rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer focus:ring-2 focus:ring-ares-cyan"
            required
            disabled={!canEdit}
          />
        </div>

        <div>
          <label
            htmlFor="event-end"
            className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
          >
            End Date & Time (Optional)
          </label>
          <input
            id="event-end"
            type="datetime-local"
            value={formDateEnd}
            onChange={(e) => setFormDateEnd(e.target.value)}
            className="w-full bg-black/60 border border-white/10 text-marble/95 text-xs rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer focus:ring-2 focus:ring-ares-cyan"
            disabled={!canEdit}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Location selector */}
        <div className="space-y-2">
          <div className="flex justify-between items-center mb-2">
            <label
              htmlFor="event-location-select"
              className="block text-[10px] font-bold uppercase tracking-wider text-marble/60"
            >
              Location / Venue
            </label>
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(true)}
                className="text-[9px] font-black uppercase tracking-widest text-ares-cyan hover:text-ares-cyan/80 transition-colors cursor-pointer"
              >
                + Manage Locations
              </button>
            )}
          </div>
          <select
            id="event-location-select"
            value={formLocationId || "mars-building"}
            onChange={(e) => {
              const val = e.target.value;
              setFormLocationId(val);
            }}
            disabled={!canEdit}
            className="w-full bg-black/60 border border-white/10 text-xs text-white rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer focus:ring-2 focus:ring-ares-cyan"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id} className="bg-ares-gray-deep text-white">
                {loc.name}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-marble/45 font-medium leading-relaxed">
            Need a new location? Configure options directly using the map builder layouts.
          </p>
        </div>

        {/* Location Preview Card */}
        {formLocationId !== "" && (
          <div className="p-4 bg-white/5 border border-white/5 rounded-lg flex flex-col justify-between min-h-[100px] hover:border-white/10 transition-colors">
            {(() => {
              const selected = locations.find((l) => l.id === formLocationId);
              if (!selected) return <p className="text-[10px] text-marble/40">MARS Building Default</p>;
              return (
                <>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-tight flex items-center gap-1.5">
                      <MapPin size={12} className="text-ares-gold" />
                      {selected.name}
                    </h4>
                    <p className="text-[10px] text-marble/65 mt-1 font-mono">{selected.address}</p>
                    {selected.description && (
                      <p className="text-[9px] text-marble/45 mt-2 leading-relaxed italic">
                        {selected.description}
                      </p>
                    )}
                  </div>
                  {selected.gmapsUrl && (
                    <a
                      href={selected.gmapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] text-ares-cyan hover:underline font-bold uppercase tracking-widest mt-3 block"
                    >
                      Open Google Directions ↗
                    </a>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">
          Cover Image (Optional)
        </label>
        <div className="flex gap-3 items-center">
          <input
            type="url"
            placeholder="Paste image link, or pick from gallery..."
            value={formCoverImage}
            onChange={(e) => setFormCoverImage(e.target.value)}
            disabled={!canEdit}
            className="flex-grow bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
          />
          <button
            type="button"
            onClick={() => setIsPhotoPickerOpen(true)}
            disabled={!canEdit}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-marble/90 hover:text-white text-[10px] uppercase font-black tracking-widest rounded transition-all cursor-pointer flex items-center gap-1.5 focus:ring-2 focus:ring-ares-cyan focus:outline-none shrink-0 disabled:opacity-50"
          >
            <ImageIcon size={12} /> Gallery
          </button>
        </div>
        {formCoverImage && (
          <div className="mt-3 relative w-48 h-28 border border-white/10 rounded-lg overflow-hidden group">
            <img src={getSafeImageUrl(formCoverImage)} alt="Cover preview" className="w-full h-full object-cover" />
            {canEdit && (
              <button
                type="button"
                onClick={() => setFormCoverImage("")}
                className="absolute top-1.5 right-1.5 p-1 bg-black/80 hover:bg-black border border-white/10 text-white rounded-full transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
              >
                <X size={10} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">
            Event Category
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormCategory("internal")}
              disabled={!canEdit}
              className={`flex-1 py-2 rounded text-xs uppercase font-bold tracking-wider transition-all border cursor-pointer disabled:opacity-50 ${
                formCategory === "internal"
                  ? "bg-ares-red/15 border-ares-red text-white font-black"
                  : "bg-transparent border-white/10 text-marble/55 hover:text-white"
              }`}
            >
              Internal Practice
            </button>
            <button
              type="button"
              onClick={() => setFormCategory("outreach")}
              disabled={!canEdit}
              className={`flex-1 py-2 rounded text-xs uppercase font-bold tracking-wider transition-all border cursor-pointer disabled:opacity-50 ${
                formCategory === "outreach"
                  ? "bg-ares-gold/15 border-ares-gold text-ares-gold font-black"
                  : "bg-transparent border-white/10 text-marble/55 hover:text-white"
              }`}
            >
              Outreach & STEM
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">
              Potluck
            </span>
            <div className="flex gap-1 bg-black/20 p-1 border border-white/5 rounded">
              <button
                type="button"
                onClick={() => setFormIsPotluck(0)}
                disabled={!canEdit}
                className={`flex-1 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer disabled:opacity-50 ${
                  formIsPotluck === 0 ? "bg-white/10 text-white" : "text-marble/45"
                }`}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => setFormIsPotluck(1)}
                disabled={!canEdit}
                className={`flex-1 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer disabled:opacity-50 ${
                  formIsPotluck === 1 ? "bg-ares-gold/20 text-ares-gold font-black" : "text-marble/45"
                }`}
              >
                Yes
              </button>
            </div>
          </div>

          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">
              Volunteer Ops
            </span>
            <div className="flex gap-1 bg-black/20 p-1 border border-white/5 rounded">
              <button
                type="button"
                onClick={() => setFormIsVolunteer(0)}
                disabled={!canEdit}
                className={`flex-1 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer disabled:opacity-50 ${
                  formIsVolunteer === 0 ? "bg-white/10 text-white" : "text-marble/45"
                }`}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => setFormIsVolunteer(1)}
                disabled={!canEdit}
                className={`flex-1 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer disabled:opacity-50 ${
                  formIsVolunteer === 1 ? "bg-ares-cyan/20 text-ares-cyan font-black" : "text-marble/45"
                }`}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Publish Status (Approval Workflow) */}
      <div className="p-4 bg-white/5 border border-white/5 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Shield size={12} className="text-ares-gold" />
            Event Publishing Status
          </h4>
          <p className="text-[10px] text-marble/60 mt-1 leading-relaxed">
            {canPublishDirectly
              ? "You have Coach/Mentor authorization to directly publish to the public calendar."
              : "Events created by students require approval from a Coach or Mentor before appearing on the public calendar."}
          </p>
        </div>

        <div className="min-w-[160px] shrink-0">
          {canPublishDirectly ? (
            <select
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as any)}
              disabled={!canEdit}
              className="w-full bg-black/60 border border-white/10 text-xs text-white rounded px-3 py-2 focus:outline-none focus:border-ares-red cursor-pointer focus:ring-2 focus:ring-ares-cyan font-bold"
            >
              <option value="published" className="bg-neutral-900 text-white font-bold">Published</option>
              <option value="pending" className="bg-neutral-900 text-white font-bold">Pending Review</option>
              <option value="draft" className="bg-neutral-900 text-white font-bold">Draft</option>
            </select>
          ) : (
            <span className="inline-flex items-center rounded-full bg-ares-gold/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-ares-gold ring-1 ring-inset ring-ares-gold/30">
              ● Pending Review
            </span>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="event-desc-editor"
          className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
        >
          Description & Logistical Details (Markdown supported)
        </label>
        <MarkdownEditor
          value={formDescription}
          onChange={setFormDescription}
          placeholder="e.g. Schedule for driver trials. Bringing snacks: yes. Intaking linear rail repairs first."
        />
      </div>
    </div>
  );
}
