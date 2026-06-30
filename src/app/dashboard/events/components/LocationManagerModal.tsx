"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { db } from "@/lib/firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { MapPin, X, Pencil, Trash2 } from "lucide-react";
import { cleanUndefined } from "@/lib/utils";

import { TeamLocation } from "@/types/location";
import { MOCK_LOCATIONS } from "@/utils/constants";
export type { TeamLocation };
export { MOCK_LOCATIONS };

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
  const [editingLocation, setEditingLocation] = useState<TeamLocation | null>(null);
  const [locFormName, setLocFormName] = useState("");
  const [locFormAddress, setLocFormAddress] = useState("");
  const [locFormDescription, setLocFormDescription] = useState("");
  const [locFormGmapsUrl, setLocFormGmapsUrl] = useState("");


  const slugify = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  // Action: Save Location (Create or Update)
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locFormName.trim() || !locFormAddress.trim()) return;

    const targetLocId = editingLocation?.id || slugify(locFormName.trim()) || `loc_${Date.now()}`;
    const newLoc: TeamLocation = {
      id: targetLocId,
      name: locFormName.trim(),
      address: locFormAddress.trim(),
      description: locFormDescription.trim() || undefined,
      gmapsUrl: locFormGmapsUrl.trim() || undefined
    };

    try {
      await setDoc(doc(db, "locations", targetLocId), cleanUndefined(newLoc));

      // Clear form
      setEditingLocation(null);
      setLocFormName("");
      setLocFormAddress("");
      setLocFormDescription("");
      setLocFormGmapsUrl("");

      // Auto-select in editor
      setFormLocationId(targetLocId);
    } catch (err) {
      console.warn("Unable to save location online.", err);
      if (editingLocation) {
        setLocations(locations.map((l) => (l.id === editingLocation.id ? newLoc : l)));
      } else {
        setLocations([...locations, newLoc]);
      }
      setFormLocationId(targetLocId);

      setEditingLocation(null);
      setLocFormName("");
      setLocFormAddress("");
      setLocFormDescription("");
      setLocFormGmapsUrl("");
    }
  };

  // Action: Delete Location
  const handleDeleteLocation = async (locId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this venue? Any event referencing this venue will default back to the MARS Building."
      )
    )
      return;

    try {
      await deleteDoc(doc(db, "locations", locId));
      if (formLocationId === locId) {
        setFormLocationId("mars-building");
      }
    } catch (err) {
      console.warn("Unable to delete location online.", err);
      setLocations(locations.filter((l) => l.id !== locId));
      if (formLocationId === locId) {
        setFormLocationId("mars-building");
      }
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
                  Saved Venues ({locations.length})
                </h4>

                {locations.length === 0 ? (
                  <div className="py-12 text-center text-[9px] font-mono text-marble/35 uppercase tracking-widest border border-dashed border-white/10 rounded-lg">
                    No locations saved yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {locations.map((loc) => (
                      <div
                        key={loc.id}
                        className={`p-3 border rounded-lg transition-all text-left flex items-start justify-between gap-3 ${
                          editingLocation?.id === loc.id
                            ? "bg-ares-gold/15 border-ares-gold"
                            : "bg-white/5 border-white/5 hover:border-white/15"
                        }`}
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="text-xs font-bold text-white uppercase tracking-tight truncate flex items-center gap-1.5">
                            {loc.name}
                            {loc.id === "mars-building" && (
                              <span className="bg-ares-gold/20 text-ares-gold text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded border border-ares-gold/30 uppercase shrink-0">
                                Default
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-marble/60 font-medium truncate">{loc.address}</p>
                          {loc.description && (
                            <p className="text-[9px] text-marble/40 line-clamp-1 italic">{loc.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLocation(loc);
                              setLocFormName(loc.name);
                              setLocFormAddress(loc.address);
                              setLocFormDescription(loc.description || "");
                              setLocFormGmapsUrl(loc.gmapsUrl || "");
                            }}
                            className="p-1.5 bg-white/5 hover:bg-white/10 text-white rounded border border-white/10 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none"
                            title="Edit Venue"
                          >
                            <Pencil size={11} />
                          </button>
                          {loc.id !== "mars-building" && (
                            <button
                              type="button"
                              onClick={() => handleDeleteLocation(loc.id)}
                              className="p-1.5 bg-white/5 hover:bg-ares-red/25 text-white/70 hover:text-white rounded border border-white/10 hover:border-ares-red/35 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none"
                              title="Delete Venue"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Add/Edit Form */}
              <form
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
                </div>

                <div className="pt-4 border-t border-white/5 flex gap-2 shrink-0">
                  {editingLocation && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLocation(null);
                        setLocFormName("");
                        setLocFormAddress("");
                        setLocFormDescription("");
                        setLocFormGmapsUrl("");
                      }}
                      className="px-3 py-2 border border-white/10 hover:bg-white/5 text-marble/60 hover:text-white rounded text-[9px] uppercase font-black tracking-widest cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-grow py-2 bg-ares-gold text-black font-black uppercase tracking-widest text-[9px] rounded hover:brightness-105 transition-all shadow-md focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none cursor-pointer"
                  >
                    {editingLocation ? "Save Updates" : "Create Venue"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
