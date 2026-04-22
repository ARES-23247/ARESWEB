import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useRichEditor } from "./editor/useRichEditor";
import RichEditorToolbar from "./editor/RichEditorToolbar";
import AssetPickerModal from "./AssetPickerModal";
import { DEFAULT_COVER_IMAGE } from "../utils/constants";
import { useAdminSettings } from "../hooks/useAdminSettings";
import { useImageUpload } from "../hooks/useImageUpload";
import { useEntityFetch } from "../hooks/useEntityFetch";
import { postSchema } from "../schemas/postSchema";
import { adminApi } from "../api/adminApi";
import { useModal } from "../contexts/ModalContext";

export default function BlogEditor({ userRole }: { userRole?: string | unknown }) {
  const { editSlug } = useParams<{ editSlug?: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const modal = useModal();
  
  // Custom Hooks
  const { availableSocials } = useAdminSettings();
  const { uploadFile, isUploading: isUploadingCover, errorMsg: uploadError, setErrorMsg: setUploadError } = useImageUpload();

  // Local State
  const [isPending, setIsPending] = useState(false);
  const [title, setTitle] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState(DEFAULT_COVER_IMAGE);
  const [errorMsg, setErrorMsg] = useState("");
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

  const editor = useRichEditor({ placeholder: "<p>Start drafting your robotics article here. Tell us about your journey to Einstein...</p>" });

  useEntityFetch<{ post?: { title: string, published_at: string, thumbnail: string, ast: string } }>(
    editSlug ? `/api/admin/posts/${editSlug}/detail` : null,
    (data) => {
      if (data?.post) {
        setTitle(data.post.title || "");
        setPublishedAt(data.post.published_at || "");
        if (data.post.thumbnail) setCoverImageUrl(data.post.thumbnail);
        if (editor && data.post.ast) {
          try {
            editor.commands.setContent(JSON.parse(data.post.ast));
          } catch (e) {
            console.error("Failed to parse existing AST", e);
          }
        }
      }
    }
  );

  // Sync upload errors to local error state
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (uploadError) setErrorMsg(uploadError);
  }, [uploadError]);

  const handlePublish = async (isDraft: boolean = false) => {
    if (!title || !editor) {
      setErrorMsg("Title and content are required.");
      return;
    }

    setIsPending(true);
    setErrorMsg("");

    try {
      const ast = editor.getJSON();
      
      const payloadResult = postSchema.safeParse({
        title,
        coverImageUrl: coverImageUrl === DEFAULT_COVER_IMAGE ? "" : coverImageUrl,
        ast,
        socials,
        isDraft,
        publishedAt: publishedAt || undefined,
      });

      if (!payloadResult.success) {
        setErrorMsg(payloadResult.error.issues[0].message);
        setIsPending(false);
        return;
      }

      const data = editSlug 
        ? await adminApi.updatePost(editSlug, payloadResult.data)
        : await adminApi.createPost(payloadResult.data);

      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["posts"] });
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["posts"] }), 1500);
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["posts"] }), 3000);
        queryClient.invalidateQueries({ queryKey: ["admin_posts"] });
        
        if (data.warning) {
          toast.info("Post saved successfully, but social syndication had issues:\n\n" + data.warning);
        }

        navigate(`/blog/${data.slug}`);
      } else {
        setErrorMsg(data.error || "Failed to publish");
      }
    } catch {
      setErrorMsg("Network error — could not reach the API.");
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async () => {
    if (!editSlug) return;
    const confirmed = await modal.confirm({
      title: "Delete Post",
      description: "Are you sure you want to permanently delete this post?",
      confirmText: "Delete",
      destructive: true,
    });
    if (!confirmed) return;

    setIsPending(true);
    setErrorMsg("");
    try {
      await adminApi.deletePost(editSlug);
      navigate("/dashboard");
    } catch {
      setErrorMsg("Failed to delete the post. Please try again.");
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
            className="w-full bg-zinc-950 border border-zinc-800 ares-cut-sm px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-ares-red focus:border-ares-red transition-all shadow-inner lg:text-lg"
            placeholder='e.g. Our Road to State'
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
              className="w-full bg-zinc-950 border border-zinc-800 ares-cut-sm px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-600 focus:border-zinc-600 transition-all shadow-inner lg:text-lg"
              placeholder="https://..."
            />
            <button 
              className={`px-4 py-3 ares-cut-sm text-sm font-bold border border-zinc-700 transition-all focus:outline-none focus:ring-2 focus:ring-ares-red ${isUploadingCover ? "bg-zinc-800 text-zinc-300 animate-pulse" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"}`}
              onClick={() => document.getElementById('cover-upload')?.click()}
            >
              UPL
            </button>
            <button 
              className="px-6 py-3 ares-cut-sm text-sm font-bold border border-ares-gold/30 transition-all focus:outline-none focus:ring-2 focus:ring-ares-gold ring-offset-2 ring-offset-zinc-900 bg-ares-gold/20 text-ares-gold hover:bg-ares-gold hover:text-black whitespace-nowrap"
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
                try {
                  setUploadError("");
                  const { url } = await uploadFile(file);
                  setCoverImageUrl(url);
                } catch {
                  // error is handled by hook
                }
              }} 
            />
          </div>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 md:max-w-xs">
          <label htmlFor="post-published-at" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Schedule Publish Time</label>
          <input
            id="post-published-at" type="datetime-local"
            value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 ares-cut-sm px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
      </div>

      {/* Social Syndication Controls */}
      {availableSocials.length > 0 && (
        <div className="bg-zinc-900/30 border border-zinc-800/50 ares-cut-sm p-4 shadow-inner">
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
        <div className="flex gap-4">
          {editSlug && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="px-6 py-3.5 rounded-full font-bold transition-all shadow-xl disabled:opacity-50 border border-ares-red/30 bg-ares-red/10 text-ares-red hover:bg-ares-red hover:text-white"
            >
              DELETE
            </button>
          )}
          <button
            onClick={() => handlePublish(true)}
            disabled={isPending}
            className={`px-6 py-3.5 rounded-full font-bold transition-all shadow-xl disabled:opacity-50 border border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800`}
          >
            {isPending ? "SAVING..." : "SAVE AS DRAFT"}
          </button>
          <button
            onClick={() => handlePublish(false)}
            disabled={isPending}
            className={`flex items-center justify-center min-w-[200px] px-8 py-3.5 rounded-full font-bold tracking-wide transition-all shadow-xl disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ares-red ring-offset-2 ring-offset-zinc-900
              ${isPending ? "bg-zinc-800 text-zinc-300 animate-pulse" : "bg-white text-zinc-950 hover:bg-ares-red hover:text-white hover:-translate-y-0.5"}`}
          >
            {isPending ? "COMMITTING..." : editSlug ? "UPDATE ENTRY" : (userRole === "author" ? "SUBMIT FOR REVIEW" : "PUBLISH ENTRY")}
          </button>
        </div>
      </div>
    </div>
  );
}
