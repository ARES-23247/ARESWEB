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
import { z } from "zod";
import { postSchema, PostPayload } from "@shared/schemas/postSchema";
import { api } from "../api/client";
import { useModal } from "../contexts/ModalContext";
import CoverAssetPicker from "./editor/CoverAssetPicker";
import SocialSyndicationGrid from "./editor/SocialSyndicationGrid";
import EditorFooter from "./editor/EditorFooter";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCw } from "lucide-react";

import SeasonPicker from "./SeasonPicker";

import { CollaborativeEditorRoom, useCollaborativeEditor } from "./editor/CollaborativeEditorRoom";
import VersionHistorySidebar from "./editor/VersionHistorySidebar";

function BlogEditorInner({ editSlug, userRole, roomId }: { editSlug?: string, userRole?: string | unknown, roomId?: string | null }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const modal = useModal();
  
  // Custom Hooks
  const { availableSocials } = useAdminSettings();
  const { uploadFile, isUploading: isUploadingCover, setErrorMsg: setUploadError } = useImageUpload();

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<z.input<typeof postSchema>>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: "",
      thumbnail: DEFAULT_COVER_IMAGE,
      ast: {},
      socials: {
        discord: true,
        bluesky: true,
        slack: false,
        teams: false,
        gchat: false,
        facebook: false,
        twitter: false,
        instagram: false
      },
      isDraft: false,
      publishedAt: "",
      seasonId: undefined
    }
  });

  const title = useWatch({ control, name: "title" });
  const thumbnail = useWatch({ control, name: "thumbnail" });
  const socials = useWatch({ control, name: "socials" }) || {};
  const seasonId = useWatch({ control, name: "seasonId" });

  // Local State for visual UI toggles
  const [errorMsg, setErrorMsg] = useState("");
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const { ydoc, provider } = useCollaborativeEditor();
  const editor = useRichEditor({ 
    placeholder: "<p>Start drafting your robotics article here. Tell us about your journey to Einstein...</p>",
    ydoc,
    provider
  });

  // Use standard API query instead of custom useEntityFetch
  const { data: postRes, isLoading, isError } = api.posts.getAdminPost.useQuery(
    ["admin_post_detail", editSlug || ""],
    { 
      params: { slug: editSlug || "" } 
    },
    { 
      enabled: !!editSlug
    }
  );

  useEffect(() => {
    if (postRes?.status === 200 && postRes.body.post) {
      const post = postRes.body.post;
      reset({
        title: post.title || "",
        publishedAt: post.published_at || "",
        seasonId: post.season_id ? Number(post.season_id) : undefined,
        thumbnail: post.thumbnail || DEFAULT_COVER_IMAGE,
        ast: post.ast ? JSON.parse(post.ast) : {},
        socials: (postRes.body as unknown as { socials?: Record<string, boolean> }).socials || {}
      });
      if (editor && post.ast) {
        // In collaborative mode, avoid overwriting active live edits with the static DB snapshot.
        const shouldSetContent = !ydoc || ydoc.getXmlFragment("default").length === 0;
        
        if (shouldSetContent) {
          try {
            editor.commands.setContent(JSON.parse(post.ast));
          } catch (e) {
            console.error("Failed to parse existing AST", e);
          }
        }
      }
    }

  }, [postRes, reset, editor, ydoc]);

  const saveMutation = api.posts.savePost.useMutation({
    onSuccess: (data: { status: number; body?: { warning?: string; error?: string; slug?: string; isDraft?: boolean } | null }) => {
      if (data.status === 200 || data.status === 207) {
        queryClient.invalidateQueries({ queryKey: ["posts"] });
        queryClient.invalidateQueries({ queryKey: ["admin_posts"] });
        
        if (data.body?.warning) {
          toast.info("Post saved successfully, but social syndication had issues:\n\n" + data.body.warning);
        }

        if (data.body?.isDraft || userRole === "author") {
          navigate("/dashboard");
        } else {
          navigate(`/blog/${data.body?.slug}`);
        }
      } else {
        setErrorMsg(data.body?.error || "Failed to publish");
      }
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || "Publication failed");
    }
  });

  const updateMutation = api.posts.updatePost.useMutation({
    onSuccess: (data: { status: number; body: { warning?: string; isDraft?: boolean; slug?: string; error?: string } }) => {
      if (data.status === 200 || data.status === 207) {
        queryClient.invalidateQueries({ queryKey: ["posts"] });
        queryClient.invalidateQueries({ queryKey: ["admin_posts"] });
        if (editSlug) queryClient.invalidateQueries({ queryKey: ["post", editSlug] });
        
        if (data.body?.warning) {
          toast.info("Post updated successfully, but social syndication had issues:\n\n" + data.body.warning);
        }

        if (data.body?.isDraft || userRole === "author") {
          navigate("/dashboard");
        } else {
          navigate(`/blog/${data.body?.slug || editSlug}`);
        }
      } else {
        setErrorMsg(data.body?.error || "Failed to update");
      }
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || "Update failed");
    }
  });

  const deleteMutation = api.posts.deletePost.useMutation({
    onSuccess: (data: { status: number }) => {
      if (data.status === 200) {
        queryClient.invalidateQueries({ queryKey: ["posts"] });
        queryClient.invalidateQueries({ queryKey: ["admin_posts"] });
        navigate("/dashboard");
      } else {
        setErrorMsg("Failed to delete the post. Please try again.");
      }
    },
    onError: () => {
      setErrorMsg("Failed to delete the post. Please try again.");
    }
  });

  const onFormSubmit = (data: PostPayload, isDraft = false) => {
    if (!editor) return;
    const ast = editor.getJSON();
    const payload = { ...data, ast, isDraft, thumbnail: data.thumbnail === DEFAULT_COVER_IMAGE ? "" : data.thumbnail };
    if (editSlug) {
      updateMutation.mutate({ params: { slug: editSlug }, body: payload });
    } else {
      saveMutation.mutate({ body: payload });
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

    deleteMutation.mutate({ params: { slug: editSlug }, body: {} });
  };


  if (isLoading) return <div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-ares-red" size={32} /></div>;

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

      {isError && (
        <div className="bg-ares-red/10 border border-ares-red/30 p-4 ares-cut-sm text-ares-red text-xs font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
          COMMUNICATION FAULT: Failed to retrieve record from server.
        </div>
      )}

      {/* Settings Grid */}
      <div className="flex flex-col md:flex-row gap-4 mt-2">
        <div className="flex-1">
          <label htmlFor="post-title" className="block text-xs font-bold text-marble/40 uppercase tracking-wider mb-2">Post Title</label>
          <input
            id="post-title"
            type="text"
            {...register("title")}
            className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/30 focus:outline-none focus:ring-1 focus:ring-ares-red focus:border-ares-red transition-all shadow-inner lg:text-lg"
            placeholder='e.g. Our Road to State'
          />
          {errors.title && <p className="text-[10px] font-black uppercase text-ares-red mt-1">{errors.title.message}</p>}
        </div>
        <div className="flex-1">
          <CoverAssetPicker 
            coverImage={thumbnail || DEFAULT_COVER_IMAGE}
            isUploading={isUploadingCover}
            onLibraryClick={() => setIsCoverPickerOpen(true)}
            onUrlChange={(url) => setValue("thumbnail", url)}
            onFileChange={async (file) => {
              try {
                setUploadError("");
                const { url } = await uploadFile(file);
                setValue("thumbnail", url);
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
            {...register("publishedAt")}
            className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/30 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
        <div className="flex-1 md:max-w-xs">
          <SeasonPicker value={seasonId || ""} onChange={(val) => setValue("seasonId", val ? Number(val) : undefined)} />
        </div>
      </div>



      {/* ===== Unified Rich Editor ===== */}
      <RichEditorToolbar editor={editor} documentTitle={title} />

      {/* Cover Image Picker Modal */}
      <AssetPickerModal 
        isOpen={isCoverPickerOpen}
        onClose={() => setIsCoverPickerOpen(false)}
        onSelect={(url) => {
          setValue("thumbnail", url);
          setIsCoverPickerOpen(false);
        }}
      />

      <EditorFooter 
        errorMsg={errorMsg || (errors.ast?.message as unknown as string) || ""}
        isPending={saveMutation.isPending}
        isEditing={!!editSlug}
        onDelete={handleDelete}
        onSaveDraft={() => handleSubmit((d: unknown) => onFormSubmit(d as PostPayload, true))()}
        onPublish={() => handleSubmit((d: unknown) => onFormSubmit(d as PostPayload, false))()}
        deleteText="DELETE"
        updateText="UPDATE ENTRY"
        publishText={userRole === "author" ? "SUBMIT FOR REVIEW" : "PUBLISH ENTRY"}
        userRole={userRole}
        roundedClass="ares-cut"
        onShowHistory={roomId && editor ? () => setIsHistoryOpen(true) : undefined}
        extraControls={
          <SocialSyndicationGrid 
            availableSocials={availableSocials}
            socials={socials}
            onChange={(platform, val) => setValue(`socials.${platform}`, val)}
            isEdit={!!editSlug}
          />
        }
      />

      {isHistoryOpen && roomId && editor && (
        <VersionHistorySidebar 
          roomId={roomId}
          editor={editor}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
    </div>
  );
}

export default function BlogEditor({ userRole }: { userRole?: string | unknown }) {
  const { editSlug } = useParams<{ editSlug?: string }>();

  // Use a predictable room ID based on the post slug
  const roomId = editSlug ? `blog_${editSlug}` : null;

  if (roomId) {
    return (
      <CollaborativeEditorRoom roomId={roomId}>
        <BlogEditorInner editSlug={editSlug} userRole={userRole} roomId={roomId} />
      </CollaborativeEditorRoom>
    );
  }

  // Single player mode for new documents until they are saved and get a slug
  return <BlogEditorInner editSlug={editSlug} userRole={userRole} roomId={roomId} />;
}
