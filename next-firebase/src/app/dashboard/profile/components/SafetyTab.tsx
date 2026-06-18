import React from "react";
import { User, Info } from "lucide-react";

interface SafetyTabProps {
  tshirtSize: string;
  setTshirtSize: (val: string) => void;
  availableDietary: string[];
  dietaryRestrictions: string[];
  handleDietaryToggle: (item: string) => void;
  emergencyContactName: string;
  setEmergencyContactName: (val: string) => void;
  emergencyContactPhone: string;
  setEmergencyContactPhone: (val: string) => void;
}

export default function SafetyTab({
  tshirtSize,
  setTshirtSize,
  availableDietary,
  dietaryRestrictions,
  handleDietaryToggle,
  emergencyContactName,
  setEmergencyContactName,
  emergencyContactPhone,
  setEmergencyContactPhone,
}: SafetyTabProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-black text-ares-gold uppercase tracking-widest border-b border-white/5 pb-2.5 flex items-center gap-2">
        <User size={14} /> Logistics Details
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="profile-tshirt-size" className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">T-shirt Size</label>
          <select
            id="profile-tshirt-size"
            value={tshirtSize}
            onChange={(e) => setTshirtSize(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
          >
            <option value="">Select size...</option>
            <option value="xs">XS</option>
            <option value="s">S</option>
            <option value="m">M</option>
            <option value="l">L</option>
            <option value="xl">XL</option>
            <option value="xxl">XXL</option>
            <option value="3xl">3XL</option>
          </select>
        </div>
      </div>

      <div className="bg-black/25 border border-white/5 p-4 rounded-xl">
        <label className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-3">Dietary Restrictions</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {availableDietary.map((item) => {
            const isSelected = dietaryRestrictions.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => handleDietaryToggle(item)}
                className={`px-4 py-3 ares-cut-sm border text-[10px] font-black uppercase tracking-wider text-center cursor-pointer transition-all ${
                  isSelected
                    ? "bg-ares-gold/20 text-ares-gold border-ares-gold/50"
                    : "bg-white/5 text-marble/65 border-transparent hover:bg-white/10 hover:text-white"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-white/5 my-4" />

      <h3 className="text-sm font-black text-ares-gold uppercase tracking-widest pb-2.5 flex items-center gap-2">
        <Info size={14} /> Emergency Contacts
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="profile-emergency-name" className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Emergency Contact Name</label>
          <input
            id="profile-emergency-name"
            type="text"
            value={emergencyContactName}
            onChange={(e) => setEmergencyContactName(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
            placeholder="e.g. Jane Doe"
          />
        </div>
        <div>
          <label htmlFor="profile-emergency-phone" className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Emergency Contact Phone</label>
          <input
            id="profile-emergency-phone"
            type="tel"
            value={emergencyContactPhone}
            onChange={(e) => setEmergencyContactPhone(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
            placeholder="e.g. 304-555-0100"
          />
        </div>
      </div>
    </div>
  );
}
