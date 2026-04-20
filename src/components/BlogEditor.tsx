import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useRichEditor } from "./editor/useRichEditor";
import RichEditorToolbar from "./editor/RichEditorToolbar";
import AssetPickerModal from "./AssetPickerModal";
import { compressImage } from "../utils/imageProcessor";
import { DEFAULT_COVER_IMAGE } from "../utils/constants";

export default function BlogEditor({ editSlug, onClearEdit }: { editSlug?: string | null; onClearEdit?: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isPending, setIsPending] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState(DEFAULT_COVER_IMAGE);
  const [errorMsg, setErrorMsg] = useState("");
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  const [socials, setSocials] = useState<Record<string, boolean>>({
    discord: true,
    bluesky: true,
    slack: false,
    teams: false,
    gchat: false,
    facebook: false,
    twitter: false,
    instagram: false
  });
  const [availableSocials, setAvailableSocials] = useState<string[]>([]);

  const editor = useRichEditor({ placeholder: "<p>Start drafting your robotics article here. Tell us about your journey to Einstein...</p>" });

  const uploadFile = async (file: File): Promise<{url: string, altText?: string}> => {
    const { blob: compressedBlob, ext } = await compressImage(file);
    const formData = new FormData();
    formData.append("file", compressedBlob, file.name.replace(/\.[^/.]+$/, ext));
    const res = await fetch("/dashboard/api/admin/upload", { method: "POST", credentials: "include", body: formData });
    const data = await res.json();
    // @ts-expect-error -- D1 untyped response
    if (!data.url) throw new Error(data.error || "Upload failed");
    // @ts-expect-error -- D1 untyped response
    return { url: data.url, altText: data.altText };
  };

  useEffect(() => {
    if (!editSlug) return;
    const fetchPost = async () => {
      try {
        const res = await fetch(`/api/posts/${editSlug}`);
        const data = await res.json();
      // @ts-expect-error -- D1 untyped response
        if (data.post) {
      // @ts-expect-error -- D1 untyped response
          setTitle(data.post.title || "");
          if (editor) {
            try {
      // @ts-expect-error -- D1 untyped response
              editor.commands.setContent(JSON.parse(data.post.ast));
            } catch (e) {
              console.error("Failed to parse existing AST", e);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load post for editing", err);
      }
    };
    fetchPost();
  }, [editSlug, editor]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/dashboard/api/admin/settings", { credentials: "include" });
        const data = await res.json();
        if (data.success && data.settings) {
          const config = data.settings;
          const available = [];
          if (config.DISCORD_WEBHOOK_URL) available.push("discord");
          if (config.BLUESKY_HANDLE && config.BLUESKY_APP_PASSWORD) available.push("bluesky");
          if (config.SLACK_WEBHOOK_URL) available.push("slack");
          if (config.TEAMS_WEBHOOK_URL) available.push("teams");
          if (config.GCHAT_WEBHOOK_URL) available.push("gchat");
          if (config.FACEBOOK_ACCESS_TOKEN) available.push("facebook");
          if (config.TWITTER_ACCESS_TOKEN) available.push("twitter");
          if (config.INSTAGRAM_ACCESS_TOKEN) available.push("instagram");
          setAvailableSocials(available);
        }
      } catch (err) {
        console.error("Failed to fetch available socials:", err);
      }
    };
    fetchSettings();
  }, []);

  const handlePublish = async () => {
    if (!title || !editor) {
      setErrorMsg("Title and content are required.");
      return;
    }

    setIsPending(true);
    setErrorMsg("");

    try {
      const ast = editor.getJSON();

      const method = editSlug ? "PUT" : "POST";
      const url = editSlug ? `/dashboard/api/admin/posts/${editSlug}` : "/dashboard/api/admin/posts";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, author, coverImageUrl, ast, socials: editSlug ? null : socials }),
      });

      const data = await res.json();

      // @ts-expect-error -- D1 untyped response
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["posts"] });
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["posts"] }), 1500);
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["posts"] }), 3000);
        queryClient.invalidateQueries({ queryKey: ["admin_posts"] });
        if (onClearEdit) onClearEdit();
        
      // @ts-expect-error -- D1 untyped response
        if (data.warning) {
      // @ts-expect-error -- D1 untyped response
          alert("Post saved successfully, but social syndication had issues:\n\n" + data.warning);
        }

      // @ts-expect-error -- D1 untyped response
        navigate(`/blog/${data.slug}`);
      } else {
      // @ts-expect-error -- D1 untyped response
        setErrorMsg(data.error || "Failed to publish");
      }
    } catch {
      setErrorMsg("Network error — could not reach the API.");
    } finally {
      setIsPending(false);
    }
  };

  if (!editor) return <div className="text-zinc-300 animate-pulse font-mono tracking-widest text-sm">Booting Editor System...</div>;

  return (
    <div className="flex flex-col gap-6 w-full relative">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
          {editSlug ? "Edit Entry" : "Publish Entry"}
        </h2>
        <p className="text-zinc-400 text-sm">
          {editSlug ? "Modify an existing engineering or outreach update." : "Draft rich-text engineering and outreach updates."}
        </p>
      </div>

      {/* Settings Grid */}
      <div className="flex flex-col md:flex-row gap-4 mt-2">
        <div className="flex-1">
          <label htmlFor="post-title" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Post Title</label>
          <input
            id="post-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-ares-red focus:border-ares-red transition-all shadow-inner lg:text-lg"
            placeholder='e.g. Our Road to State'
          />
        </div>
        <div className="flex-1">
          <label htmlFor="author-name" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Author Name</label>
          <input
            id="author-name"
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-ares-gold focus:border-ares-gold transition-all shadow-inner lg:text-lg"
            placeholder="e.g. Software Team"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="cover-asset" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Cover Asset</label>
          <div className="flex gap-2 relative">
            <input
              id="cover-asset"
              type="text"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-600 focus:border-zinc-600 transition-all shadow-inner lg:text-lg"
              placeholder="https://..."
            />
            <button 
              className={`px-4 py-3 rounded-lg text-sm font-bold border border-zinc-700 transition-all focus:outline-none focus:ring-2 focus:ring-ares-red ${isUploadingCover ? "bg-zinc-800 text-zinc-300 animate-pulse" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"}`}
              onClick={() => document.getElementById('cover-upload')?.click()}
            >
              UPL
            </button>
            <button 
              className="px-6 py-3 rounded-lg text-sm font-bold border border-ares-gold/30 transition-all focus:outline-none focus:ring-2 focus:ring-ares-gold ring-offset-2 ring-offset-zinc-900 bg-ares-gold/20 text-ares-gold hover:bg-ares-gold hover:text-black whitespace-nowrap"
              onClick={() => setIsCoverPickerOpen(true)}
            >
              Library
            </button>
            <input 
              id="cover-upload" 
              type="file" 
              accept="image/*,.heic,.heif" 
              className="hidden" 
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setIsUploadingCover(true);
                try {
                  const { url } = await uploadFile(file);
                  setCoverImageUrl(url);
                } catch(err) {
                  setErrorMsg(String(err));
                } finally {
                  setIsUploadingCover(false);
                }
              }} 
            />
          </div>
        </div>
      </div>

      {/* Social Syndication Controls */}
      {!editSlug && availableSocials.length > 0 && (
        <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4 shadow-inner">
          <div className="flex items-center gap-2 mb-3">
             <div className="w-2 h-2 rounded-full bg-ares-cyan animate-pulse"></div>
             <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Broadcast & Social Syndication</span>
          </div>
          <div className="flex flex-wrap gap-4">
            {availableSocials.map(platform => (
              <label key={platform} className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={socials[platform] || false}
                  onChange={(e) => setSocials(prev => ({ ...prev, [platform]: e.target.checked }))}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-ares-red focus:ring-ares-red transition-all cursor-pointer"
                />
                <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors capitalize">
                  {platform}
                </span>
              </label>
            ))}
          </div>
          <p className="text-[10px] text-zinc-500 mt-2 italic font-mono uppercase tracking-tighter">
            * Selected platforms will receive a preview card and link immediately upon publication.
          </p>
        </div>
      )}

      {/* ===== Unified Rich Editor ===== */}
      <RichEditorToolbar editor={editor} documentTitle={title} />

      {/* Cover Image Picker Modal */}
      <AssetPickerModal 
        isOpen={isCoverPickerOpen}
        onClose={() => setIsCoverPickerOpen(false)}
        onSelect={(url) => {
          setCoverImageUrl(url);
          setIsCoverPickerOpen(false);
        }}
      />

      {/* Footer */}
      <div className="flex items-center justify-between mt-6 pt-6 border-t border-zinc-800">
        <span className="text-ares-red text-sm font-medium">{errorMsg}</span>
        <button
          onClick={handlePublish}
          disabled={isPending}
          className={`flex items-center justify-center min-w-[200px] px-8 py-3.5 rounded-full font-bold tracking-wide transition-all shadow-xl disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ares-red ring-offset-2 ring-offset-zinc-900
            ${isPending ? "bg-zinc-800 text-zinc-300 animate-pulse" : "bg-white text-zinc-950 hover:bg-ares-red hover:text-white hover:-translate-y-0.5"}`}
        >
          {isPending ? "COMMITTING..." : editSlug ? "UPDATE ENTRY" : "PUBLISH ENTRY"}
        </button>
      </div>
    </div>
  );
}
