import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { useRichEditor } from "./editor/useRichEditor";
import RichEditorToolbar from "./editor/RichEditorToolbar";
import { CopilotMenu } from "./editor/CopilotMenu";
import AssetPickerModal from "./AssetPickerModal";
import { DEFAULT_COVER_IMAGE } from "../utils/constants";
import { useAdminSettings } from "../hooks/useAdminSettings";
import { useImageUpload } from "../hooks/useImageUpload";
import { z } from "zod";
import { postSchema, PostPayload } from "@shared/schemas/postSchema";
import { useGetAdminPost, useSavePost, useUpdatePost, useDeletePost, type SavePostResponse, type UpdatePostResponse } from "../api";
import { useModal } from "../contexts/ModalContext";
import CoverAssetPicker from "./editor/CoverAssetPicker";
import SocialSyndicationGrid from "./editor/SocialSyndicationGrid";
import EditorFooter from "./editor/EditorFooter";
import { useForm } from "@tanstack/react-form";
import type { Form } from "@tanstack/react-form";
import { RefreshCw } from "lucide-react";

import SeasonPicker from "./SeasonPicker";

import { CollaborativeEditorRoom, useCollaborativeEditor } from "./editor/CollaborativeEditorRoom";
import VersionHistorySidebar from "./editor/VersionHistorySidebar";

import ZulipThread from "./ZulipThread";

function BlogEditorInner({ editSlug, userRole, roomId }: { editSlug?: string, userRole?: string | unknown, roomId?: string | null }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const modal = useModal();
  
  // Custom Hooks
  const { availableSocials } = useAdminSettings();
  const { uploadFile, isUploading: isUploadingCover, setErrorMsg: setUploadError } = useImageUpload();

  const form = useForm<PostPayload>({
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

  const { Provider: FormProvider } = form;
  const { ydoc, provider } = useCollaborativeEditor();
  const editor = useRichEditor({ 
    placeholder: "<p>Start drafting your robotics article here. Tell us about your journey to Einstein...</p>",
    ydoc,
    provider
  });

  // Use standard API query instead of custom useEntityFetch
  const { data: postRes, isLoading, isError } = useGetAdminPost(editSlug || "");

  useEffect(() => {
    if (postRes && postRes.post) {
      const post = postRes.post;
      form.setFieldValue("title", post.title || "");
      form.setFieldValue("publishedAt", post.published_at || "");
      form.setFieldValue("seasonId", post.season_id ? Number(post.season_id) : undefined);
      form.setFieldValue("thumbnail", post.thumbnail || DEFAULT_COVER_IMAGE);
      form.setFieldValue("ast", post.ast ? JSON.parse(post.ast) : {});
      form.setFieldValue("socials", (postRes as unknown as { socials?: Record<string, boolean> }).socials || {});
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

  }, [postRes, form, editor, ydoc]);

  const saveMutation = useSavePost({
    onSuccess: (data: SavePostResponse) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin_posts"] });

      if (data.warning) {
        toast.info("Post saved successfully, but social syndication had issues:\n\n" + data.warning);
      }

      navigate({ to: "/dashboard" });
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || "Publication failed");
    }
  });

  const updateMutation = useUpdatePost({
    onSuccess: (data: UpdatePostResponse) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin_posts"] });
      if (editSlug) queryClient.invalidateQueries({ queryKey: ["post", editSlug] });

      if (data.warning) {
        toast.info("Post updated successfully, but social syndication had issues:\n\n" + data.warning);
      }

      navigate({ to: `/blog/${data.slug || editSlug}` });
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || "Update failed");
    }
  });

  const deleteMutation = useDeletePost({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin_posts"] });
      navigate({ to: "/dashboard/manage_blog" });
    },
    onError: () => {
      setErrorMsg("Failed to delete the post. Please try again.");
    }
  });

  const onFormSubmit = (isDraft = false) => {
    if (!editor) return;
    const ast = editor.getJSON();
    const formValue = form.state.values;
    const payload = { ...formValue, ast, isDraft, thumbnail: formValue.thumbnail === DEFAULT_COVER_IMAGE ? "" : formValue.thumbnail };
    if (editSlug) {
      updateMutation.mutate({ slug: editSlug, body: payload });
    } else {
      saveMutation.mutate(payload);
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

    deleteMutation.mutate(editSlug);
  };


  if (isLoading) return <div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-ares-red" size={32} /></div>;

  if (!editor) return <div className="text-marble animate-pulse font-mono tracking-widest text-sm">Booting Editor System...</div>;

  return (
    <FormProvider>
      <div className="flex flex-col gap-6 w-full relative h-full">
        <div className="flex flex-col gap-6 flex-1 min-w-0">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
            {editSlug ? "Edit Entry" : "Publish Entry"}
          </h2>
          <p className="text-marble/60 text-sm">
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
          <label htmlFor="post-title" className="block text-xs font-bold text-marble/60 uppercase tracking-wider mb-2">Post Title</label>
          <form.Field
            name="title"
            children={(field) => (
              <>
                <input
                  id="post-title"
                  type="text"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/30 focus:outline-none focus:ring-1 focus:ring-ares-red focus:border-ares-red transition-all shadow-inner lg:text-lg"
                  placeholder='e.g. Our Road to State'
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-[10px] font-black uppercase text-ares-red mt-1">{field.state.meta.errors[0]}</p>
                )}
              </>
            )}
          />
        </div>
        <div className="flex-1">
          <CoverAssetPicker
            label="Cover Image"
            coverImage={form.UseFieldState("thumbnail").value || DEFAULT_COVER_IMAGE}
            isUploading={isUploadingCover}
            onLibraryClick={() => setIsCoverPickerOpen(true)}
            onUrlChange={(url) => form.setFieldValue("thumbnail", url)}
            onFileChange={async (file) => {
              try {
                setUploadError("");
                const { url } = await uploadFile(file);
                form.setFieldValue("thumbnail", url);
              } catch {
                // handled by hook
              }
            }}
          />
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 md:max-w-xs">
          <label htmlFor="post-published-at" className="block text-xs font-bold text-marble/60 uppercase tracking-wider mb-2">Schedule Publish Time</label>
          <form.Field
            name="publishedAt"
            children={(field) => (
              <input
                id="post-published-at" type="datetime-local"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/30 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
              />
            )}
          />
        </div>
        <div className="flex-1 md:max-w-xs">
          <form.Field
            name="seasonId"
            children={(field) => (
              <SeasonPicker value={field.state.value || ""} onChange={(val) => field.handleChange(val ? Number(val) : undefined)} />
            )}
          />
        </div>
      </div>



      {/* ===== Unified Rich Editor ===== */}
      <div className="flex items-center gap-2">
        <div className="flex-1"><RichEditorToolbar editor={editor} documentTitle={form.UseFieldState("title").value} /></div>
      </div>
      <CopilotMenu editor={editor} />

      {/* Cover Image Picker Modal */}
      <AssetPickerModal
        isOpen={isCoverPickerOpen}
        onClose={() => setIsCoverPickerOpen(false)}
        onSelect={(url) => {
          form.setFieldValue("thumbnail", url);
          setIsCoverPickerOpen(false);
        }}
      />

      <EditorFooter
        errorMsg={errorMsg || ""}
        isPending={saveMutation.isPending}
        isEditing={!!editSlug}
        onDelete={handleDelete}
        onSaveDraft={() => onFormSubmit(true)}
        onPublish={() => onFormSubmit(false)}
        deleteText="DELETE"
        updateText="UPDATE ENTRY"
        publishText={userRole === "author" ? "SUBMIT FOR REVIEW" : "PUBLISH ENTRY"}
        userRole={userRole}
        roundedClass="ares-cut"
        onShowHistory={roomId && editor ? () => setIsHistoryOpen(true) : undefined}
        extraControls={
          <SocialSyndicationGrid
            availableSocials={availableSocials}
            socials={form.UseFieldState("socials").value}
            onChange={(platform, val) => form.setFieldValue(`socials.${platform}`, val)}
            isEdit={!!editSlug}
          />
        }
      />

      {isHistoryOpen && roomId && editor && (
        <VersionHistorySidebar 
          roomId={roomId}
          editor={editor}
          onClose={() => setIsHistoryOpen(false)}
          historyUrl={editSlug ? `/api/posts/admin/${editSlug}/history` : undefined}
        />
      )}
      </div>

      {editSlug && postRes?.post && (
        <div className="w-full flex flex-col gap-6 mt-6">
          <ZulipThread
            stream={postRes.post.zulip_stream || "blog"}
            topic={postRes.post.zulip_topic || `Blog: ${postRes.post.title}`}
          />
        </div>
      )}
      </div>
    </div>
    </FormProvider>
  );
}

export default function BlogEditor({ userRole }: { userRole?: string | unknown }) {
  const { editSlug } = useParams({ strict: false }) as Record<string, string>;

  const [draftId] = useState(() => `draft_blog_${crypto.randomUUID?.() || Math.random().toString(36).substring(2)}`);
  const roomId = editSlug ? `blog_${editSlug}` : draftId;

  return (
    <CollaborativeEditorRoom roomId={roomId}>
      <BlogEditorInner editSlug={editSlug} userRole={userRole} roomId={roomId} />
    </CollaborativeEditorRoom>
  );
}


