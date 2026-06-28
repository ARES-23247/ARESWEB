import React from "react";
import { Sparkles, Info } from "lucide-react";

interface IdentityTabProps {
  nickname: string;
  setNickname: (val: string) => void;
  firstName: string;
  setFirstName: (val: string) => void;
  lastName: string;
  setLastName: (val: string) => void;
  pronouns: string;
  setPronouns: (val: string) => void;
  avatar: string;
  setAvatar: (val: string) => void;
  setIsAvatarCreatorOpen: (val: boolean) => void;
  bio: string;
  setBio: (val: string) => void;
  favoriteFirstThing: string;
  setFavoriteFirstThing: (val: string) => void;
  favoriteRobotMechanism: string;
  setFavoriteRobotMechanism: (val: string) => void;
  preMatchSuperstition: string;
  setPreMatchSuperstition: (val: string) => void;
  funFact: string;
  setFunFact: (val: string) => void;
}

export default function IdentityTab({
  nickname,
  setNickname,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  pronouns,
  setPronouns,
  avatar,
  setAvatar,
  setIsAvatarCreatorOpen,
  bio,
  setBio,
  favoriteFirstThing,
  setFavoriteFirstThing,
  favoriteRobotMechanism,
  setFavoriteRobotMechanism,
  preMatchSuperstition,
  setPreMatchSuperstition,
  funFact,
  setFunFact,
}: IdentityTabProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-black text-ares-gold uppercase tracking-widest border-b border-white/5 pb-2.5 flex items-center gap-2">
        <Sparkles size={14} /> Identity Details
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label htmlFor="profile-nickname" className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Nickname *</label>
          <input
            id="profile-nickname"
            type="text"
            required
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan transition-colors"
            placeholder="e.g. David"
          />
        </div>
        <div>
          <label htmlFor="profile-first-name" className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">First Name</label>
          <input
            id="profile-first-name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan transition-colors"
            placeholder="Legal first name"
          />
        </div>
        <div>
          <label htmlFor="profile-last-name" className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Last Name</label>
          <input
            id="profile-last-name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan transition-colors"
            placeholder="Legal last name"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="profile-pronouns" className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Pronouns</label>
          <input
            id="profile-pronouns"
            type="text"
            value={pronouns}
            onChange={(e) => setPronouns(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan transition-colors"
            placeholder="e.g. he/him"
          />
        </div>
        <div>
          <label htmlFor="profile-avatar-url" className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Avatar Image URL</label>
          <div className="flex flex-col sm:flex-row gap-4">
            {avatar && (
              <div className="w-12 h-12 rounded-lg bg-black/30 border border-white/10 flex items-center justify-center p-1 shrink-0">
                <img src={avatar} alt="Avatar Preview" className="w-full h-full object-contain" />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <input
                id="profile-avatar-url"
                type="url"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan transition-colors"
                placeholder="https://..."
              />
              <button
                type="button"
                onClick={() => setIsAvatarCreatorOpen(true)}
                className="px-3 py-1.5 bg-ares-gold/15 hover:bg-ares-gold/25 border border-ares-gold/30 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Customize Avatar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="profile-bio" className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Biography</label>
        <textarea
          id="profile-bio"
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan transition-colors resize-none"
          placeholder="Tell us about your interest in robotics, engineering, or team role..."
        />
      </div>

      <div className="h-px bg-white/5 my-4" />

      <h3 className="text-sm font-black text-ares-gold uppercase tracking-widest pb-2.5 flex items-center gap-2">
        <Info size={14} /> Fun & Trivia
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="profile-favorite-first" className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Favorite thing about *FIRST*®</label>
          <input
            id="profile-favorite-first"
            type="text"
            value={favoriteFirstThing}
            onChange={(e) => setFavoriteFirstThing(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan transition-colors"
            placeholder="e.g. Gracious Professionalism, building code..."
          />
        </div>
        <div>
          <label htmlFor="profile-favorite-mech" className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Favorite Robot Mechanism</label>
          <input
            id="profile-favorite-mech"
            type="text"
            value={favoriteRobotMechanism}
            onChange={(e) => setFavoriteRobotMechanism(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan transition-colors"
            placeholder="e.g. Virtual Pivot Intake, active hang assembly..."
          />
        </div>
        <div>
          <label htmlFor="profile-superstition" className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Pre-match superstition</label>
          <input
            id="profile-superstition"
            type="text"
            value={preMatchSuperstition}
            onChange={(e) => setPreMatchSuperstition(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan transition-colors"
            placeholder="e.g. fist-bumping drive coach, checking telemetry offsets..."
          />
        </div>
        <div>
          <label htmlFor="profile-fun-fact" className="block text-[10px] uppercase font-bold text-marble/60 tracking-wider mb-2">Fun Fact</label>
          <input
            id="profile-fun-fact"
            type="text"
            value={funFact}
            onChange={(e) => setFunFact(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-ares-gold/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan transition-colors"
            placeholder="A strange or unique fact about you..."
          />
        </div>
      </div>
    </div>
  );
}
