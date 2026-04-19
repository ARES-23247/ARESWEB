import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw, Save, Image as ImageIcon } from "lucide-react";
import { authClient, useSession } from "../utils/auth-client";

interface AvatarEditorProps {
  onClose: () => void;
}

const DICEBEAR_STYLES = [
  { id: "bottts", name: "ARES Bots", desc: "Mechanical robot avatars" },
  { id: "avataaars", name: "Humans", desc: "Customizable human avatars" },
  { id: "identicon", name: "Geometry", desc: "Abstract geometric patterns" },
  { id: "notionists", name: "Sketches", desc: "Notion-style illustrations" },
  { id: "lorelei", name: "Lorelei", desc: "Cute stylized characters" },
];

export default function AvatarEditor({ onClose }: AvatarEditorProps) {
  const { data: session } = useSession();
  const [style, setStyle] = useState(DICEBEAR_STYLES[0].id);
  const [seed, setSeed] = useState(() => session?.user?.id || Math.random().toString(36).substring(7));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUrl = `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const { error: apiError } = await authClient.updateUser({
        image: currentUrl
      });
      
      if (apiError) throw new Error(apiError.message || "Failed to update profile image");
      
      // Force reload to reflect the updated session image if not automatically synced
      window.location.reload();
    } catch (err) {
      setError(String(err));
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-xl bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between p-6 border-b border-white/5">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ImageIcon className="text-ares-red" />
              Customize Identity
            </h2>
            <button
              onClick={onClose}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            <div className="flex flex-col items-center gap-6 mb-8">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-ares-red/20 to-ares-gold/20 blur-xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative w-40 h-40 rounded-full bg-zinc-950 border border-white/10 overflow-hidden shadow-2xl flex items-center justify-center p-2">
                  <img
                    src={currentUrl}
                    alt="Avatar Preview"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
              <button
                onClick={() => setSeed(Math.random().toString(36).substring(7))}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-semibold transition-colors"
              >
                <RefreshCw size={14} />
                Randomize Seed
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
                  Visual Style
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {DICEBEAR_STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStyle(s.id)}
                      className={`text-left p-3 rounded-2xl border transition-all ${
                        style === s.id
                          ? "bg-ares-red/10 border-ares-red text-white"
                          : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                      }`}
                    >
                      <span className="block text-sm font-bold">{s.name}</span>
                      <span className="block text-xs opacity-70 mt-1 line-clamp-1">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="seed-token" className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
                  Seed Token
                </label>
                <input
                  id="seed-token"
                  type="text"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-ares-red focus:border-transparent transition-all"
                  placeholder="Type anything..."
                  maxLength={32}
                />
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-semibold">
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="p-6 border-t border-white/5 bg-black/20 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 font-semibold text-sm bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 font-bold text-sm bg-gradient-to-r from-ares-red to-red-700 hover:from-red-600 hover:to-red-800 text-white rounded-xl shadow-lg hover:shadow-red-900/50 transition-all disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
              {isSaving ? "Saving..." : "Apply Identity"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
