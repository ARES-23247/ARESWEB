import React from "react";
import { User, Info } from "lucide-react";

interface PrivacyTabProps {
  contactEmail: string;
  setContactEmail: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
  showOnAbout: boolean;
  setShowOnAbout: (val: boolean) => void;
  showEmail: boolean;
  setShowEmail: (val: boolean) => void;
  showPhone: boolean;
  setShowPhone: (val: boolean) => void;
  isStudent?: boolean;
}

export default function PrivacyTab({
  contactEmail,
  setContactEmail,
  phone,
  setPhone,
  showOnAbout,
  setShowOnAbout,
  showEmail,
  setShowEmail,
  showPhone,
  setShowPhone,
  isStudent = false,
}: PrivacyTabProps) {
  return (
    <div className="space-y-6">
      {isStudent && (
        <div className="bg-ares-gold/10 border border-ares-gold/20 p-4 rounded-xl text-ares-gold text-xs leading-normal">
          <strong>FIRST® Youth Protection Program (YPP):</strong> As a student member, your contact details (email and phone number) are protected under YPP rules. They are kept securely hidden from public profiles and verified members, and are visible only to team administrators.
        </div>
      )}

      {!isStudent && (
        <>
          <h3 className="text-sm font-black text-ares-gold uppercase tracking-widest border-b border-white/5 pb-2.5 flex items-center gap-2">
            <User size={14} /> Contact Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="profile-contact-email" className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Contact Email</label>
              <input
                id="profile-contact-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
                placeholder="e.g. contact@email.com"
              />
            </div>
            <div>
              <label htmlFor="profile-phone" className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Phone Number</label>
              <input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none transition-colors"
                placeholder="e.g. 304-555-0199"
              />
            </div>
          </div>

          <div className="h-px bg-white/5 my-4" />
        </>
      )}

      <h3 className="text-sm font-black text-ares-gold uppercase tracking-widest pb-2.5 flex items-center gap-2">
        <Info size={14} /> Roster & Privacy Options
      </h3>

      <div className="space-y-4 bg-black/20 border border-white/5 p-5 rounded-xl">
        <label htmlFor="show-on-about" className="flex items-start gap-3 select-none cursor-pointer">
          <input
            id="show-on-about"
            type="checkbox"
            checked={showOnAbout}
            onChange={(e) => setShowOnAbout(e.target.checked)}
            className="w-4.5 h-4.5 rounded border-white/10 bg-black/40 text-ares-red focus:ring-ares-red mt-0.5 shrink-0"
          />
          <div>
            <span className="text-xs font-extrabold text-white uppercase tracking-wider block">Display on Public Roster</span>
            <span className="text-[10px] text-marble/60 leading-normal block mt-0.5">Allow your profile biography, nickname, and subteams to be listed on the public About page.</span>
          </div>
        </label>

        {!isStudent && (
          <>
            <label htmlFor="show-email" className="flex items-start gap-3 select-none cursor-pointer">
              <input
                id="show-email"
                type="checkbox"
                checked={showEmail}
                onChange={(e) => setShowEmail(e.target.checked)}
                className="w-4.5 h-4.5 rounded border-white/10 bg-black/40 text-ares-red focus:ring-ares-red mt-0.5 shrink-0"
              />
              <div>
                <span className="text-xs font-extrabold text-white uppercase tracking-wider block">Show Email to Verified Members</span>
                <span className="text-[10px] text-marble/60 leading-normal block mt-0.5">Expose your contact email to other logged-in team members in the internal directory.</span>
              </div>
            </label>

            <label htmlFor="show-phone" className="flex items-start gap-3 select-none cursor-pointer">
              <input
                id="show-phone"
                type="checkbox"
                checked={showPhone}
                onChange={(e) => setShowPhone(e.target.checked)}
                className="w-4.5 h-4.5 rounded border-white/10 bg-black/40 text-ares-red focus:ring-ares-red mt-0.5 shrink-0"
              />
              <div>
                <span className="text-xs font-extrabold text-white uppercase tracking-wider block">Show Phone to Verified Members</span>
                <span className="text-[10px] text-marble/60 leading-normal block mt-0.5">Expose your phone number to other logged-in team members in the internal directory.</span>
              </div>
            </label>
          </>
        )}
      </div>
    </div>
  );
}
