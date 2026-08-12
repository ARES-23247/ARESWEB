"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { MapPin, X, Pencil, Trash2, RotateCcw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  archiveLocation,
  createLocation,
  restoreLocation,
  updateLocation,
} from "@/app/calendar/api";

import { TeamLocation } from "@/types/location";
export type { TeamLocation };

interface LocationManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: TeamLocation[];
  setLocations: React.Dispatch<React.SetStateAction<TeamLocation[]>>;
  formLocationId: string;
  setFormLocationId: (id: string) => void;
}

export default function LocationManagerModal({
  isOpen,
  onClose,
  locations,
  setLocations,
  formLocationId,
  setFormLocationId
}: LocationManagerModalProps) {
  const { authorizedUser } = useAuth();
  const canManage = !!authorizedUser && ["admin", "coach", "mentor"].includes(authorizedUser.role);
  const [editingLocation, setEditingLocation] = useState<TeamLocation | null>(null);
  const [locFormName, setLocFormName] = useState("");
  const [locFormAddress, setLocFormAddress] = useState("");
  const [locFormDescription, setLocFormDescription] = useState("");
  const [locFormGmapsUrl, setLocFormGmapsUrl] = useState("");
  const [locFormIsAddressPublic, setLocFormIsAddressPublic] = useState(false);
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);
  const [operationStatus, setOperationStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setEditingLocation(null);
    setLocFormName("");
    setLocFormAddress("");
    setLocFormDescription("");
    setLocFormGmapsUrl("");
    setLocFormIsAddressPublic(false);
  };

  // Action: Save Location (Create or Update)
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !locFormName.trim() || !locFormAddress.trim()) return;
    setIsSaving(true);
    setOperationStatus(null);
    const input = {
      name: locFormName.trim(),
      address: locFormAddress.trim(),
      description: locFormDescription.trim() || undefined,
      gmapsUrl: locFormGmapsUrl.trim() || undefined,
      isAddressPublic: locFormIsAddressPublic ? 1 as const : 0 as const,
    };

    try {
      const savedLocation = editingLocation
        ? await updateLocation(editingLocation.id, input)
        : await createLocation(input);
      if (editingLocation) {
        setLocations((current) => current.map((location) => location.id === savedLocation.id ? savedLocation : location));
      } else {
        setLocations((current) => [...current, savedLocation].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setFormLocationId(savedLocation.id);
      setOperationStatus({ kind: "success", message: editingLocation ? "Venue updated." : "Venue created." });
      resetForm();
    } catch (error) {
      console.error("Unable to save location:", error);
      setOperationStatus({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchiveLocation = async (locId: string) => {
    if (!canManage) return;
    setOperationStatus(null);
    try {
      await archiveLocation(locId);
      setLocations((current) => current.map((location) => location.id === locId ? { ...location, isDeleted: 1 } : location));
      if (formLocationId === locId) {
        setFormLocationId("");
      }
      setPendingArchiveId(null);
      setOperationStatus({ kind: "success", message: "Venue archived. Existing events keep their saved venue name." });
    } catch (error) {
      console.error("Unable to archive location:", error);
      setOperationStatus({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleRestoreLocation = async (locId: string) => {
    if (!canManage) return;
    setOperationStatus(null);
    try {
      await restoreLocation(locId);
      setLocations((current) => current.map((location) => location.id === locId ? { ...location, isDeleted: 0 } : location));
      setOperationStatus({ kind: "success", message: "Venue restored." });
    } catch (error) {
      console.error("Unable to restore location:", error);
      setOperationStatus({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[100]" />
        <Dialog.Content className="fixed inset-0 z-[101] flex items-center justify-center p-4 outline-none">
          <div className="w-full max-w-4xl bg-black/90 border border-white/10 rounded-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden outline-none">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <Dialog.Title className="text-white font-extrabold text-base uppercase tracking-tight flex items-center gap-2 m-0">
                  <MapPin size={18} className="text-ares-gold" />
                  Manage Team Venues & Locations
                </Dialog.Title>
                <p className="text-[10px] text-marble/55 uppercase tracking-wider mt-0.5 m-0">
                  Configure saved locations for calendar events and directions
                </p>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close venue manager"
                  className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-full transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none"
                >
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>

            {/* Split Content */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
              {/* Left Column: Locations List */}
              <div className="w-full md:w-1/2 border-r border-white/10 p-5 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-white/5">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-marble/60 mb-2">
                  Saved Venues ({locations.filter((location) => location.isDeleted !== 1).length} active)
                </h4>

                {locations.length === 0 ? (
                  <div className="py-12 text-center text-[9px] font-mono text-marble/35 uppercase tracking-widest border border-dashed border-white/10 rounded-lg">
                    No locations saved yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {locations.map((loc) => (
                      <React.Fragment key={loc.id}>
                      <div
                        className={`p-3 border rounded-lg transition-all text-left flex items-start justify-between gap-3 ${
                          editingLocation?.id === loc.id
                            ? "bg-ares-gold/15 border-ares-gold"
                            : "bg-white/5 border-white/5 hover:border-white/15"
                        }`}
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="text-xs font-bold text-white uppercase tracking-tight truncate flex items-center gap-1.5">
                            {loc.name}
                            {loc.isDeleted === 1 && (
                              <span className="bg-ares-red text-white text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded border border-ares-bronze uppercase shrink-0">
                                Archived
                              </span>
                            )}
                            {loc.isDeleted !== 1 && loc.isAddressPublic === 1 && (
                              <span className="bg-ares-gold/15 text-ares-gold text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded border border-ares-gold/30 uppercase shrink-0">
                                Public address
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-marble/60 font-medium truncate">{loc.address}</p>
                          {loc.description && (
                            <p className="text-[9px] text-marble/40 line-clamp-1 italic">{loc.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {canManage && loc.isDeleted !== 1 && <button
                            type="button"
                            onClick={() => {
                              setEditingLocation(loc);
                              setLocFormName(loc.name);
                              setLocFormAddress(loc.address);
                              setLocFormDescription(loc.description || "");
                              setLocFormGmapsUrl(loc.gmapsUrl || "");
                              setLocFormIsAddressPublic(loc.isAddressPublic === 1);
                            }}
                            className="p-1.5 bg-white/5 hover:bg-white/10 text-white rounded border border-white/10 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none"
                            title="Edit Venue"
                            aria-label={`Edit venue ${loc.name}`}
                          >
                            <Pencil size={11} />
                          </button>}
                          {canManage && loc.isDeleted !== 1 ? (
                            <button
                              type="button"
                              onClick={() => setPendingArchiveId(loc.id)}
                              className="p-1.5 bg-white/5 hover:bg-ares-red/25 text-white/70 hover:text-white rounded border border-white/10 hover:border-ares-red/35 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none"
                              title="Archive Venue"
                              aria-label={`Archive venue ${loc.name}`}
                            >
                              <Trash2 size={11} />
                            </button>
                          ) : canManage ? (
                            <button type="button" onClick={() => void handleRestoreLocation(loc.id)} className="p-1.5 bg-ares-gold/10 hover:bg-ares-gold/20 text-ares-gold rounded border border-ares-gold/30 focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none" aria-label={`Restore venue ${loc.name}`}>
                              <RotateCcw aria-hidden="true" size={11} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {pendingArchiveId === loc.id && (
                        <div role="alertdialog" aria-label={`Confirm archive of ${loc.name}`} className="mt-2 rounded border border-ares-red/35 bg-ares-red/10 p-3 text-[10px] text-white">
                          <p>This venue will leave new event forms. Existing events keep their saved venue name.</p>
                          <div className="mt-2 flex gap-2">
                            <button type="button" onClick={() => setPendingArchiveId(null)} className="rounded border border-white/15 px-2 py-1 font-bold focus-visible:ring-2 focus-visible:ring-ares-cyan">Cancel</button>
                            <button type="button" autoFocus onClick={() => void handleArchiveLocation(loc.id)} className="rounded bg-ares-red px-2 py-1 font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan">Archive venue</button>
                          </div>
                        </div>
                      )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Add/Edit Form */}
              {canManage ? <form
                onSubmit={handleSaveLocation}
                className="w-full md:w-1/2 p-5 overflow-y-auto space-y-4 flex flex-col justify-between scrollbar-thin scrollbar-thumb-white/5"
              >
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-marble/60">
                    {editingLocation ? `Edit Venue: ${editingLocation.name}` : "Create New Venue"}
                  </h4>

                  <div>
                    <label
                      htmlFor="loc-name"
                      className="block text-[9px] font-bold uppercase tracking-wider mb-1.5 text-marble/55"
                    >
                      Venue Name
                    </label>
                    <input
                      id="loc-name"
                      type="text"
                      placeholder="e.g. ARES Machine Shop"
                      value={locFormName}
                      onChange={(e) => setLocFormName(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-cyan"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="loc-address"
                      className="block text-[9px] font-bold uppercase tracking-wider mb-1.5 text-marble/55"
                    >
                      Physical Address
                    </label>
                    <input
                      id="loc-address"
                      type="text"
                      placeholder="e.g. 456 Tech Lane, Morgantown, WV 26505"
                      value={locFormAddress}
                      onChange={(e) => setLocFormAddress(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-cyan"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="loc-description"
                      className="block text-[9px] font-bold uppercase tracking-wider mb-1.5 text-marble/55"
                    >
                      Short Description
                    </label>
                    <textarea
                      id="loc-description"
                      placeholder="e.g. CNC machining workshop and anodizing lab. Accessible via side entrance."
                      value={locFormDescription}
                      onChange={(e) => setLocFormDescription(e.target.value)}
                      className="w-full h-16 bg-black/60 border border-white/10 rounded p-2 text-xs text-white focus:outline-none focus:border-ares-red resize-none focus:ring-2 focus:ring-ares-cyan"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="loc-gmaps"
                      className="block text-[9px] font-bold uppercase tracking-wider mb-1.5 text-marble/55"
                    >
                      Google Maps Link (Optional)
                    </label>
                    <input
                      id="loc-gmaps"
                      type="url"
                      placeholder="e.g. https://maps.google.com/?q=..."
                      value={locFormGmapsUrl}
                      onChange={(e) => setLocFormGmapsUrl(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-cyan"
                    />
                  </div>

                  <div className="rounded border border-ares-gold/25 bg-ares-gold/5 p-3">
                    <label htmlFor="loc-address-public" className="flex cursor-pointer items-start gap-3 text-xs text-white">
                      <input
                        id="loc-address-public"
                        type="checkbox"
                        checked={locFormIsAddressPublic}
                        onChange={(event) => setLocFormIsAddressPublic(event.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-ares-gold focus-visible:ring-2 focus-visible:ring-ares-cyan"
                      />
                      <span>
                        <span className="block font-bold">Publish this address</span>
                        <span className="mt-1 block text-[10px] leading-relaxed text-marble/65">
                          Allow the full venue name and address to appear on public event pages and in search metadata. Leave this off for homes, schools, or private team locations.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex gap-2 shrink-0">
                  {editingLocation && (
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                      }}
                      className="px-3 py-2 border border-white/10 hover:bg-white/5 text-marble/60 hover:text-white rounded text-[9px] uppercase font-black tracking-widest cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-grow py-2 bg-ares-gold text-black font-black uppercase tracking-widest text-[9px] rounded hover:brightness-105 transition-all shadow-md focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none cursor-pointer"
                  >
                    {isSaving ? "Saving…" : editingLocation ? "Save Updates" : "Create Venue"}
                  </button>
                </div>
              </form> : (
                <div className="w-full md:w-1/2 p-6 text-sm leading-relaxed text-marble/70">
                  Only admins, coaches, and mentors can change team venues.
                </div>
              )}
            </div>
            {operationStatus && (
              <div role={operationStatus.kind === "error" ? "alert" : "status"} className={operationStatus.kind === "error" ? "border-t border-ares-red/35 bg-ares-red/10 p-3 text-white" : "border-t border-ares-gold/30 bg-ares-gold/10 p-3 text-ares-gold"}>
                <p className={operationStatus.kind === "error" ? "font-mono text-[10px]" : "text-[10px] font-bold"}>{operationStatus.message}</p>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
