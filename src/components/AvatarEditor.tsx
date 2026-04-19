import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw, Save, Image as ImageIcon, Shuffle, ToggleLeft, ToggleRight } from "lucide-react";
import { authClient } from "../utils/auth-client";

interface AvatarEditorProps {
  currentImage?: string | null;
  onClose: () => void;
}

/* ─── DiceBear 9.x Official Parameters ──────────────────────────── */

const AVATAAARS_OPTIONS = {
  top: ["bigHair","bob","bun","curly","curvy","dreads","dreads01","dreads02","frida","frizzle","fro","froBand","hat","hijab","longButNotTooLong","miaWallace","shaggy","shaggyMullet","shavedSides","shortCurly","shortFlat","shortRound","shortWaved","sides","straight01","straight02","straightAndStrand","theCaesar","theCaesarAndSidePart","turban","winterHat1","winterHat02","winterHat03"],
  eyes: ["closed","cry","default","eyeRoll","happy","hearts","side","squint","surprised","wink","winkWacky","xDizzy"],
  eyebrows: ["angry","angryNatural","default","defaultNatural","flatNatural","frownNatural","raisedExcited","raisedExcitedNatural","sadConcerned","sadConcernedNatural","unibrowNatural","upDown","upDownNatural"],
  mouth: ["concerned","default","disbelief","eating","grimace","sad","screamOpen","serious","smile","tongue","twinkle","vomit"],
  facialHair: ["beardLight","beardMajestic","beardMedium","moustacheFancy","moustacheMagnum"],
  accessories: ["eyepatch","kurt","prescription01","prescription02","round","sunglasses","wayfarers"],
  clothing: ["blazerAndShirt","blazerAndSweater","collarAndSweater","graphicShirt","hoodie","overall","shirtCrewNeck","shirtScoopNeck","shirtVNeck"],
  hairColor: ["2c1b18","4a312c","724133","a55728","b58143","c93305","d6b370","e8e1e1","ecdcbf","f59797"],
  skinColor: ["614335","ae5d29","d08b5b","edb98a","f8d25c","fd9841","ffdbb4"],
  clothesColor: ["3c4f5c","65c9ff","262e33","5199e4","25557c","929598","a7ffc4","e6e6e6","ff5c5c","ff488e","ffffff"],
  facialHairColor: ["2c1b18","4a312c","724133","a55728","b58143","c93305","d6b370","e8e1e1","ecdcbf","f59797"],
  accessoriesColor: ["3c4f5c","65c9ff","262e33","5199e4","25557c","929598","a7ffc4","e6e6e6","ff5c5c","ff488e","ffffff"],
};

const BOTTTS_OPTIONS = {
  face: ["round01","round02","square01","square02","square03","square04"],
  eyes: ["bulging","dizzy","eva","frame1","frame2","glow","happy","hearts","robocop","round","roundFrame01","roundFrame02","sensor","shade01"],
  mouth: ["bite","diagram","grill01","grill02","grill03","smile01","smile02","square01","square02"],
  top: ["antenna","antennaCrooked","bulb01","glowingBulb01","glowingBulb02","horns","lights","pyramid","radar"],
  sides: ["antenna01","antenna02","cables01","cables02","round","square","squareAssymetric"],
  texture: ["camo01","camo02","circuits","dirty01","dirty02","dots","grunge01","grunge02"],
  baseColor: ["00acc1","1e88e5","5e35b1","6d4c41","7cb342","8e24aa","039be5","43a047","546e7a","00897b","3949ab","757575","c0ca33","d81b60","e53935","f4511e","fb8c00","fdd835","ffb300"],
};

function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function AvatarEditor({ currentImage, onClose }: AvatarEditorProps) {
  const getParams = () => {
    try {
      if (!currentImage) return new URLSearchParams();
      const url = new URL(currentImage);
      return new URLSearchParams(url.search);
    } catch {
      return new URLSearchParams();
    }
  };

  const parsedParams = getParams();
  const isBottts = currentImage?.includes("bottts");

  const [styleMode, setStyleMode] = useState<"bottts" | "avataaars">(isBottts ? "bottts" : "avataaars");

  const getParam = (key: string, options: string[]) => {
    const val = parsedParams.get(key);
    if (val && options.includes(val)) return val;
    return getRandom(options);
  };

  // Avataaar State
  const [avaState, setAvaState] = useState({
    top: !isBottts ? getParam("top", AVATAAARS_OPTIONS.top) : getRandom(AVATAAARS_OPTIONS.top),
    eyes: !isBottts ? getParam("eyes", AVATAAARS_OPTIONS.eyes) : getRandom(AVATAAARS_OPTIONS.eyes),
    eyebrows: !isBottts ? getParam("eyebrows", AVATAAARS_OPTIONS.eyebrows) : getRandom(AVATAAARS_OPTIONS.eyebrows),
    mouth: !isBottts ? getParam("mouth", AVATAAARS_OPTIONS.mouth) : getRandom(AVATAAARS_OPTIONS.mouth),
    hairColor: !isBottts ? getParam("hairColor", AVATAAARS_OPTIONS.hairColor) : getRandom(AVATAAARS_OPTIONS.hairColor),
    clothing: !isBottts ? getParam("clothing", AVATAAARS_OPTIONS.clothing) : getRandom(AVATAAARS_OPTIONS.clothing),
    clothesColor: !isBottts ? getParam("clothesColor", AVATAAARS_OPTIONS.clothesColor) : getRandom(AVATAAARS_OPTIONS.clothesColor),
    skinColor: !isBottts ? getParam("skinColor", AVATAAARS_OPTIONS.skinColor) : getRandom(AVATAAARS_OPTIONS.skinColor),
    facialHair: !isBottts ? getParam("facialHair", AVATAAARS_OPTIONS.facialHair) : getRandom(AVATAAARS_OPTIONS.facialHair),
    facialHairColor: !isBottts ? getParam("facialHairColor", AVATAAARS_OPTIONS.facialHairColor) : getRandom(AVATAAARS_OPTIONS.facialHairColor),
    accessories: !isBottts ? getParam("accessories", AVATAAARS_OPTIONS.accessories) : getRandom(AVATAAARS_OPTIONS.accessories),
    accessoriesColor: !isBottts ? getParam("accessoriesColor", AVATAAARS_OPTIONS.accessoriesColor) : getRandom(AVATAAARS_OPTIONS.accessoriesColor),
    showFacialHair: !isBottts ? parsedParams.get("facialHairProbability") === "100" : false,
    showAccessories: !isBottts ? parsedParams.get("accessoriesProbability") === "100" : true,
  });

  // Bottt State
  const [botState, setBotState] = useState({
    face: isBottts ? getParam("face", BOTTTS_OPTIONS.face) : getRandom(BOTTTS_OPTIONS.face),
    eyes: isBottts ? getParam("eyes", BOTTTS_OPTIONS.eyes) : getRandom(BOTTTS_OPTIONS.eyes),
    mouth: isBottts ? getParam("mouth", BOTTTS_OPTIONS.mouth) : getRandom(BOTTTS_OPTIONS.mouth),
    top: isBottts ? getParam("top", BOTTTS_OPTIONS.top) : getRandom(BOTTTS_OPTIONS.top),
    sides: isBottts ? getParam("sides", BOTTTS_OPTIONS.sides) : getRandom(BOTTTS_OPTIONS.sides),
    texture: isBottts ? getParam("texture", BOTTTS_OPTIONS.texture) : getRandom(BOTTTS_OPTIONS.texture),
    baseColor: isBottts ? getParam("baseColor", BOTTTS_OPTIONS.baseColor) : getRandom(BOTTTS_OPTIONS.baseColor),
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const randomizeAll = () => {
    if (styleMode === "avataaars") {
      setAvaState({
        top: getRandom(AVATAAARS_OPTIONS.top),
        eyes: getRandom(AVATAAARS_OPTIONS.eyes),
        eyebrows: getRandom(AVATAAARS_OPTIONS.eyebrows),
        mouth: getRandom(AVATAAARS_OPTIONS.mouth),
        hairColor: getRandom(AVATAAARS_OPTIONS.hairColor),
        clothing: getRandom(AVATAAARS_OPTIONS.clothing),
        clothesColor: getRandom(AVATAAARS_OPTIONS.clothesColor),
        skinColor: getRandom(AVATAAARS_OPTIONS.skinColor),
        facialHair: getRandom(AVATAAARS_OPTIONS.facialHair),
        facialHairColor: getRandom(AVATAAARS_OPTIONS.facialHairColor),
        accessories: getRandom(AVATAAARS_OPTIONS.accessories),
        accessoriesColor: getRandom(AVATAAARS_OPTIONS.accessoriesColor),
        showFacialHair: Math.random() > 0.5,
        showAccessories: Math.random() > 0.3,
      });
    } else {
      setBotState({
        face: getRandom(BOTTTS_OPTIONS.face),
        eyes: getRandom(BOTTTS_OPTIONS.eyes),
        mouth: getRandom(BOTTTS_OPTIONS.mouth),
        top: getRandom(BOTTTS_OPTIONS.top),
        sides: getRandom(BOTTTS_OPTIONS.sides),
        texture: getRandom(BOTTTS_OPTIONS.texture),
        baseColor: getRandom(BOTTTS_OPTIONS.baseColor),
      });
    }
  };

  const currentUrl = useMemo(() => {
    if (styleMode === "avataaars") {
      const params = new URLSearchParams();
      params.set("backgroundColor", "transparent");
      params.set("top", avaState.top);
      params.set("eyes", avaState.eyes);
      params.set("eyebrows", avaState.eyebrows);
      params.set("mouth", avaState.mouth);
      params.set("hairColor", avaState.hairColor);
      params.set("clothing", avaState.clothing);
      params.set("clothesColor", avaState.clothesColor);
      params.set("skinColor", avaState.skinColor);
      // Probability-gated features
      if (avaState.showAccessories) {
        params.set("accessories", avaState.accessories);
        params.set("accessoriesColor", avaState.accessoriesColor);
        params.set("accessoriesProbability", "100");
      } else {
        params.set("accessoriesProbability", "0");
      }
      if (avaState.showFacialHair) {
        params.set("facialHair", avaState.facialHair);
        params.set("facialHairColor", avaState.facialHairColor);
        params.set("facialHairProbability", "100");
      } else {
        params.set("facialHairProbability", "0");
      }
      return `https://api.dicebear.com/9.x/avataaars/svg?${params.toString()}`;
    } else {
      const params = new URLSearchParams();
      params.set("backgroundColor", "transparent");
      params.set("face", botState.face);
      params.set("eyes", botState.eyes);
      params.set("mouth", botState.mouth);
      params.set("top", botState.top);
      params.set("sides", botState.sides);
      params.set("texture", botState.texture);
      params.set("baseColor", botState.baseColor);
      params.set("textureProbability", "100");
      params.set("sidesProbability", "100");
      params.set("mouthProbability", "100");
      return `https://api.dicebear.com/9.x/bottts/svg?${params.toString()}`;
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
      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-ares-red appearance-none custom-select"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt.replace(/([A-Z0-9])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()}</option>
        ))}
      </select>
    </div>
  );

  const renderColorSelect = (label: string, value: string, options: string[], onChange: (val: string) => void) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((hex) => (
          <button
            key={hex}
            onClick={() => onChange(hex)}
            className={`w-7 h-7 rounded-lg border-2 transition-all ${value === hex ? "border-white scale-110 shadow-lg" : "border-transparent hover:border-white/30"}`}
            style={{ backgroundColor: `#${hex}` }}
            aria-label={`Color #${hex}`}
          />
        ))}
      </div>
    </div>
  );

  const renderToggle = (label: string, value: boolean, onChange: (val: boolean) => void) => (
    <div className="flex items-center justify-between py-2">
      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{label}</label>
      <button onClick={() => onChange(!value)} className="text-white">
        {value ? <ToggleRight size={28} className="text-ares-red" /> : <ToggleLeft size={28} className="text-zinc-600" />}
      </button>
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
          className="w-full max-w-4xl bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[95vh] md:max-h-[85vh]"
        >
          {/* Left Panel: Preview */}
          <div className="w-full md:w-2/5 p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-ares-red/10 to-transparent pointer-events-none" />
            
            <div className="relative group w-44 h-44 md:w-56 md:h-56 mb-6">
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
          <div className="w-full md:w-3/5 flex flex-col h-full bg-zinc-900/50 min-h-0">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-lg font-black flex items-center gap-2 tracking-tight">
                <ImageIcon className="text-ares-red" size={20} />
                Character Creator
              </h2>
              <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
              {/* Archetype Selector */}
              <div className="flex bg-black/50 p-1 rounded-2xl mb-6 border border-white/5">
                <button
                  onClick={() => setStyleMode("avataaars")}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${styleMode === "avataaars" ? "bg-ares-red text-white shadow-lg" : "text-zinc-500 hover:text-white"}`}
                >
                  👤 Human
                </button>
                <button
                  onClick={() => setStyleMode("bottts")}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${styleMode === "bottts" ? "bg-ares-gold text-black shadow-lg" : "text-zinc-500 hover:text-white"}`}
                >
                  🤖 Robot
                </button>
              </div>

              {/* Dynamic Property Grids */}
              <div className="space-y-5">
                {styleMode === "avataaars" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      {renderSelect("Hair Style", avaState.top, AVATAAARS_OPTIONS.top, (val) => setAvaState({...avaState, top: val}))}
                      {renderSelect("Eyes", avaState.eyes, AVATAAARS_OPTIONS.eyes, (val) => setAvaState({...avaState, eyes: val}))}
                      {renderSelect("Eyebrows", avaState.eyebrows, AVATAAARS_OPTIONS.eyebrows, (val) => setAvaState({...avaState, eyebrows: val}))}
                      {renderSelect("Mouth", avaState.mouth, AVATAAARS_OPTIONS.mouth, (val) => setAvaState({...avaState, mouth: val}))}
                      {renderSelect("Clothing", avaState.clothing, AVATAAARS_OPTIONS.clothing, (val) => setAvaState({...avaState, clothing: val}))}
                    </div>
                    <div className="space-y-3">
                      {renderColorSelect("Hair Color", avaState.hairColor, AVATAAARS_OPTIONS.hairColor, (val) => setAvaState({...avaState, hairColor: val}))}
                      {renderColorSelect("Skin Tone", avaState.skinColor, AVATAAARS_OPTIONS.skinColor, (val) => setAvaState({...avaState, skinColor: val}))}
                      {renderColorSelect("Clothes Color", avaState.clothesColor, AVATAAARS_OPTIONS.clothesColor, (val) => setAvaState({...avaState, clothesColor: val}))}
                    </div>
                    <div className="border-t border-white/5 pt-4 space-y-2">
                      {renderToggle("Show Accessories", avaState.showAccessories, (val) => setAvaState({...avaState, showAccessories: val}))}
                      {avaState.showAccessories && (
                        <>
                          {renderSelect("Accessory Type", avaState.accessories, AVATAAARS_OPTIONS.accessories, (val) => setAvaState({...avaState, accessories: val}))}
                          {renderColorSelect("Accessory Color", avaState.accessoriesColor, AVATAAARS_OPTIONS.accessoriesColor, (val) => setAvaState({...avaState, accessoriesColor: val}))}
                        </>
                      )}
                      
                      {renderToggle("Show Facial Hair", avaState.showFacialHair, (val) => setAvaState({...avaState, showFacialHair: val}))}
                      {avaState.showFacialHair && (
                        <>
                          {renderSelect("Facial Hair Style", avaState.facialHair, AVATAAARS_OPTIONS.facialHair, (val) => setAvaState({...avaState, facialHair: val}))}
                          {renderColorSelect("Facial Hair Color", avaState.facialHairColor, AVATAAARS_OPTIONS.facialHairColor, (val) => setAvaState({...avaState, facialHairColor: val}))}
                        </>
                      )}
                    </div>
                  </>
                )}

                {styleMode === "bottts" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      {renderSelect("Chassis", botState.face, BOTTTS_OPTIONS.face, (val) => setBotState({...botState, face: val}))}
                      {renderSelect("Eyes", botState.eyes, BOTTTS_OPTIONS.eyes, (val) => setBotState({...botState, eyes: val}))}
                      {renderSelect("Mouth", botState.mouth, BOTTTS_OPTIONS.mouth, (val) => setBotState({...botState, mouth: val}))}
                      {renderSelect("Antenna", botState.top, BOTTTS_OPTIONS.top, (val) => setBotState({...botState, top: val}))}
                      {renderSelect("Side Modules", botState.sides, BOTTTS_OPTIONS.sides, (val) => setBotState({...botState, sides: val}))}
                      {renderSelect("Surface Texture", botState.texture, BOTTTS_OPTIONS.texture, (val) => setBotState({...botState, texture: val}))}
                    </div>
                    {renderColorSelect("Base Color", botState.baseColor, BOTTTS_OPTIONS.baseColor, (val) => setBotState({...botState, baseColor: val}))}
                  </>
                )}
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-semibold">
                  {error}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-white/5 bg-black/20">
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
