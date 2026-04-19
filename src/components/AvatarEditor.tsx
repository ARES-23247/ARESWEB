import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw, Save, Image as ImageIcon, Shuffle } from "lucide-react";
import { authClient } from "../utils/auth-client";

interface AvatarEditorProps {
  onClose: () => void;
}

const AVATAAARS_OPTIONS = {
  top: ["bob", "bun", "curly", "dreads", "frida", "fro", "shaggy", "shaggyMullet", "longHair", "shortHair", "eyepatch", "hat", "hijab", "turban", "winterHat1"],
  hairColor: ["2c1b18", "4a3123", "b58143", "d6b370", "724133", "a55728", "c93305", "e8e1e1", "f59797", "ec36b5", "592454"],
  clothing: ["blazerAndShirt", "blazerAndSweater", "collarAndSweater", "graphicShirt", "hoodie", "overall", "shirtCrewNeck", "shirtVNeck"],
  clothingColor: ["3c4f5c", "65c9ff", "262e33", "ff5c5c", "ff488e", "a1d821", "5199e4", "e6e6e6", "929598"],
  skinColor: ["f8d25c", "fd9841", "f8d25c", "ffdbb4", "edb98a", "d08b5b", "ae5d29", "614335"],
  accessories: ["blank", "prescription01", "prescription02", "round", "sunglasses", "wayfarers"],
  facialHair: ["blank", "beardMedium", "beardLight", "beardMagestic", "moustacheFancy", "moustacheMagnum"]
};

const BOTTTS_OPTIONS = {
  base: ["cranial", "dsquad", "fractal", "glow", "jolie", "spider", "cranial"],
  eyes: ["bulging", "dizzy", "eva", "frame1", "frame2", "glow", "happy", "robocop", "round", "sensor", "shade01"],
  mouth: ["bite", "diagram", "grill", "grill01", "grill02", "smile", "square", "square01"],
  top: ["antenna", "antennaCrooked", "bulb", "glowing", "horns", "radar", "round", "square", "squareAntenna"],
  texture: ["camo", "circuits", "dirty", "dots", "grunge"],
  primaryColor: ["1e293b", "dc2626", "2563eb", "16a34a", "ca8a04", "9333ea", "db2777"]
};

function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function AvatarEditor({ onClose }: AvatarEditorProps) {
  const [styleMode, setStyleMode] = useState<"bottts" | "avataaars">("bottts");

  // Avataaar State
  const [avaState, setAvaState] = useState({
    top: getRandom(AVATAAARS_OPTIONS.top),
    hairColor: getRandom(AVATAAARS_OPTIONS.hairColor),
    clothing: getRandom(AVATAAARS_OPTIONS.clothing),
    clothingColor: getRandom(AVATAAARS_OPTIONS.clothingColor),
    skinColor: getRandom(AVATAAARS_OPTIONS.skinColor),
    accessories: getRandom(AVATAAARS_OPTIONS.accessories),
    facialHair: getRandom(AVATAAARS_OPTIONS.facialHair)
  });

  // Bottt State
  const [botState, setBotState] = useState({
    base: getRandom(BOTTTS_OPTIONS.base),
    eyes: getRandom(BOTTTS_OPTIONS.eyes),
    mouth: getRandom(BOTTTS_OPTIONS.mouth),
    top: getRandom(BOTTTS_OPTIONS.top),
    texture: getRandom(BOTTTS_OPTIONS.texture),
    primaryColor: getRandom(BOTTTS_OPTIONS.primaryColor)
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const randomizeAll = () => {
    if (styleMode === "avataaars") {
      setAvaState({
        top: getRandom(AVATAAARS_OPTIONS.top),
        hairColor: getRandom(AVATAAARS_OPTIONS.hairColor),
        clothing: getRandom(AVATAAARS_OPTIONS.clothing),
        clothingColor: getRandom(AVATAAARS_OPTIONS.clothingColor),
        skinColor: getRandom(AVATAAARS_OPTIONS.skinColor),
        accessories: getRandom(AVATAAARS_OPTIONS.accessories),
        facialHair: getRandom(AVATAAARS_OPTIONS.facialHair)
      });
    } else {
      setBotState({
        base: getRandom(BOTTTS_OPTIONS.base),
        eyes: getRandom(BOTTTS_OPTIONS.eyes),
        mouth: getRandom(BOTTTS_OPTIONS.mouth),
        top: getRandom(BOTTTS_OPTIONS.top),
        texture: getRandom(BOTTTS_OPTIONS.texture),
        primaryColor: getRandom(BOTTTS_OPTIONS.primaryColor)
      });
    }
  };

  const currentUrl = useMemo(() => {
    if (styleMode === "avataaars") {
      const q = new URLSearchParams(avaState as Record<string, string>);
      // Dicebear 9.x avataaars
      return `https://api.dicebear.com/9.x/avataaars/svg?backgroundColor=transparent&${q.toString()}`;
    } else {
      const q = new URLSearchParams(botState as Record<string, string>);
      return `https://api.dicebear.com/9.x/bottts/svg?backgroundColor=transparent&${q.toString()}`;
    }
  }, [styleMode, avaState, botState]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const { error: apiError } = await authClient.updateUser({
        image: currentUrl
      });
      
      if (apiError) throw new Error(apiError.message || "Failed to update profile image");
      window.location.reload();
    } catch (err) {
      setError(String(err));
      setIsSaving(false);
    }
  };

  const renderSelect = (label: string, value: string, options: string[], onChange: (val: string) => void) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">{label.replace(/([A-Z])/g, ' $1').trim()}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-ares-red appearance-none custom-select"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</option>
        ))}
      </select>
    </div>
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-[8px]">
        <style>{`
          .custom-select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-position: right 0.75rem center; background-repeat: no-repeat; background-size: 1rem; padding-right: 2.5rem; }
        `}</style>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-4xl bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[85vh]"
        >
          {/* Left Panel: Preview */}
          <div className="w-full md:w-1/2 p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-ares-red/10 to-transparent pointer-events-none" />
            
            <div className="relative group w-48 h-48 md:w-64 md:h-64 mb-8">
              <div className="absolute inset-0 bg-gradient-to-br from-ares-red/30 to-ares-gold/30 blur-2xl rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative w-full h-full rounded-3xl bg-zinc-900 border border-white/10 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] flex items-center justify-center p-4 z-10 backdrop-blur-xl">
                <img
                  src={currentUrl}
                  alt="Avatar Preview"
                  className="w-full h-full object-contain filter drop-shadow-2xl scale-110"
                />
              </div>
            </div>

            <button
              onClick={randomizeAll}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-sm font-bold transition-colors w-full justify-center max-w-[200px]"
            >
              <Shuffle size={16} className="text-ares-gold" />
              Randomize Traits
            </button>
          </div>

          {/* Right Panel: Editor Controls */}
          <div className="w-full md:w-1/2 flex flex-col h-full bg-zinc-900/50">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h2 className="text-xl font-black flex items-center gap-2 tracking-tight">
                <ImageIcon className="text-ares-red" />
                Character Creator
              </h2>
              <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              {/* Archetype Selector */}
              <div className="flex bg-black/50 p-1 rounded-2xl mb-8 border border-white/5">
                <button
                  onClick={() => setStyleMode("avataaars")}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${styleMode === "avataaars" ? "bg-ares-red text-white shadow-lg" : "text-zinc-500 hover:text-white"}`}
                >
                  Human (Avataaar)
                </button>
                <button
                  onClick={() => setStyleMode("bottts")}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${styleMode === "bottts" ? "bg-ares-gold text-black shadow-lg" : "text-zinc-500 hover:text-white"}`}
                >
                  Robot (Bottts)
                </button>
              </div>

              {/* Dynamic Property Grids */}
              <div className="grid grid-cols-2 gap-4">
                {styleMode === "avataaars" && (
                  <>
                    {renderSelect("Top/Hair", avaState.top, AVATAAARS_OPTIONS.top, (val) => setAvaState({...avaState, top: val}))}
                    {renderSelect("Hair Color", avaState.hairColor, AVATAAARS_OPTIONS.hairColor, (val) => setAvaState({...avaState, hairColor: val}))}
                    {renderSelect("Clothing", avaState.clothing, AVATAAARS_OPTIONS.clothing, (val) => setAvaState({...avaState, clothing: val}))}
                    {renderSelect("Fabric Color", avaState.clothingColor, AVATAAARS_OPTIONS.clothingColor, (val) => setAvaState({...avaState, clothingColor: val}))}
                    {renderSelect("Skin Tone", avaState.skinColor, AVATAAARS_OPTIONS.skinColor, (val) => setAvaState({...avaState, skinColor: val}))}
                    {renderSelect("Facial Hair", avaState.facialHair, AVATAAARS_OPTIONS.facialHair, (val) => setAvaState({...avaState, facialHair: val}))}
                    <div className="col-span-2">
                       {renderSelect("Accessories", avaState.accessories, AVATAAARS_OPTIONS.accessories, (val) => setAvaState({...avaState, accessories: val}))}
                    </div>
                  </>
                )}

                {styleMode === "bottts" && (
                  <>
                    {renderSelect("Chassis Base", botState.base, BOTTTS_OPTIONS.base, (val) => setBotState({...botState, base: val}))}
                    {renderSelect("Ocular Set", botState.eyes, BOTTTS_OPTIONS.eyes, (val) => setBotState({...botState, eyes: val}))}
                    {renderSelect("Mouth/Grill", botState.mouth, BOTTTS_OPTIONS.mouth, (val) => setBotState({...botState, mouth: val}))}
                    {renderSelect("Antenna Array", botState.top, BOTTTS_OPTIONS.top, (val) => setBotState({...botState, top: val}))}
                    {renderSelect("Paint Texture", botState.texture, BOTTTS_OPTIONS.texture, (val) => setBotState({...botState, texture: val}))}
                    {renderSelect("Primary Paint", botState.primaryColor, BOTTTS_OPTIONS.primaryColor, (val) => setBotState({...botState, primaryColor: val}))}
                  </>
                )}
              </div>

              {error && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-semibold">
                  {error}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-white/5 bg-black/20">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 py-4 font-bold text-base bg-gradient-to-r from-ares-red to-red-700 hover:from-red-600 hover:to-red-800 text-white rounded-2xl shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                {isSaving ? "Flashing Firmware..." : "Confirm & Apply Identity"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
