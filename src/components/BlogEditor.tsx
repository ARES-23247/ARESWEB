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
import CoverAssetPicker from "./editor/CoverAssetPicker";
import SocialSyndicationGrid from "./editor/SocialSyndicationGrid";
import EditorFooter from "./editor/EditorFooter";

import SeasonPicker from "./SeasonPicker";

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
  const [seasonId, setSeasonId] = useState("");
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

  useEntityFetch<{ post?: { title: string, published_at: string, thumbnail: string, ast: string, season_id?: string } }>(
    editSlug ? `/api/admin/posts/${editSlug}/detail` : null,
    (data) => {
      if (data?.post) {
        setTitle(data.post.title || "");
        setPublishedAt(data.post.published_at || "");
        setSeasonId(data.post.season_id || "");
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
        seasonId: seasonId || undefined,
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

        if (isDraft || userRole === "author") {
          navigate("/dashboard");
        } else {
          navigate(`/blog/${data.slug}`);
        }
      } else {
        setErrorMsg(data.error || "Failed to publish");
      }
    } catch (e) {
      console.error("[BlogEditor] Publication failed:", e);
      if (e instanceof Error) {
        // If it's a TypeError and the message is "Failed to fetch", it's usually a network/CORS error
        if (e.name === "TypeError" && e.message.includes("fetch")) {
          setErrorMsg("Network error — could not reach the API. Please check your connection or try again.");
        } else {
          setErrorMsg(e.message);
        }
      } else {
        setErrorMsg("An unexpected non-standard error occurred. Check console for details.");
      }
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


  if (!editor) return <div className="text-marble animate-pulse font-mono tracking-widest text-sm">Booting Editor System...</div>;

  return (
    <div className="flex flex-col gap-6 w-full relative">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
          {editSlug ? "Edit Entry" : "Publish Entry"}
        </h2>
        <p className="text-marble/40 text-sm">
          {editSlug ? "Modify an existing engineering or outreach update." : "Draft rich-text engineering and outreach updates."}
        </p>
      </div>

      {/* Settings Grid */}
      <div className="flex flex-col md:flex-row gap-4 mt-2">
        <div className="flex-1">
          <label htmlFor="post-title" className="block text-xs font-bold text-marble/40 uppercase tracking-wider mb-2">Post Title</label>
          <input
            id="post-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/30 focus:outline-none focus:ring-1 focus:ring-ares-red focus:border-ares-red transition-all shadow-inner lg:text-lg"
            placeholder='e.g. Our Road to State'
          />
        </div>
        <div className="flex-1">
          <CoverAssetPicker 
            coverImage={coverImageUrl}
            isUploading={isUploadingCover}
            onLibraryClick={() => setIsCoverPickerOpen(true)}
            onUrlChange={setCoverImageUrl}
            onFileChange={async (file) => {
              try {
                setUploadError("");
                const { url } = await uploadFile(file);
                setCoverImageUrl(url);
              } catch {
                // handled by hook
              }
            }}
          />
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 md:max-w-xs">
          <label htmlFor="post-published-at" className="block text-xs font-bold text-marble/40 uppercase tracking-wider mb-2">Schedule Publish Time</label>
          <input
            id="post-published-at" type="datetime-local"
            value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)}
            className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/30 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
        <div className="flex-1 md:max-w-xs">
          <SeasonPicker value={seasonId} onChange={setSeasonId} />
        </div>
      </div>



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

      <EditorFooter 
        errorMsg={errorMsg}
        isPending={isPending}
        isEditing={!!editSlug}
        onDelete={handleDelete}
        onSaveDraft={() => handlePublish(true)}
        onPublish={() => handlePublish(false)}
        deleteText="DELETE"
        updateText="UPDATE ENTRY"
        publishText={userRole === "author" ? "SUBMIT FOR REVIEW" : "PUBLISH ENTRY"}
        userRole={userRole}
        roundedClass="ares-cut"
        extraControls={
          <SocialSyndicationGrid 
            availableSocials={availableSocials}
            socials={socials}
            onChange={(platform, val) => setSocials(prev => ({ ...prev, [platform]: val }))}
            isEdit={!!editSlug}
          />
        }
      />
    </div>
  );
}
