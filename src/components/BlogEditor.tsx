import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { useRichEditor } from "./editor/useRichEditor";
import RichEditorToolbar from "./editor/RichEditorToolbar";
import { CopilotMenu } from "./editor/CopilotMenu";
import AssetPickerModal from "./AssetPickerModal";
import { FileBrowserModal } from "./FileBrowserModal";
import { DEFAULT_coverImage } from "../utils/constants";
import { useAdminSettings } from "../hooks/useAdminSettings";
import { useImageUpload } from "../hooks/useImageUpload";
import CoverAssetPicker from "./editor/CoverAssetPicker";
import SocialSyndicationGrid from "./editor/SocialSyndicationGrid";
import EditorFooter from "./editor/EditorFooter";
import { useForm } from "@tanstack/react-form";

import { RefreshCw } from "lucide-react";

import SeasonPicker from "./SeasonPicker";

import { CollaborativeEditorRoom, useCollaborativeEditor } from "./editor/CollaborativeEditorRoom";
import VersionHistorySidebar from "./editor/VersionHistorySidebar";

import ZulipThread from "./ZulipThread";
import { useGetAdminPost, useDeletePost, useUpdatePost, useSavePost } from "../api";
import { useModal } from "../contexts/ModalContext";
import { type SavePostResponse, type UpdatePostResponse } from "../api/posts";
import { toastApiError } from "../api/honoClient";
import type { UploadedFile } from "../api/files";
function BlogEditorInner({ editSlug, userRole, roomId }: { editSlug?: string, userRole?: string | unknown, roomId?: string | null }) {
  const { providerId } = useCollaborativeEditor();
  return <BlogEditorImpl key={providerId} editSlug={editSlug} userRole={userRole} roomId={roomId} />;
}

function BlogEditorImpl({ editSlug, userRole, roomId }: { editSlug?: string, userRole?: string | unknown, roomId?: string | null }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const modal = useModal();

  // Custom Hooks
  const { availableSocials } = useAdminSettings();
  const { uploadFile, isUploading: isUploadingCover, errorMsg: uploadError, setErrorMsg: setUploadError } = useImageUpload();
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      title: "",
      thumbnail: DEFAULT_coverImage,
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
      seasonId: undefined as number | undefined
    }
  });


  const { ydoc, provider } = useCollaborativeEditor();
  const editor = useRichEditor({
    placeholder: "<p>Start drafting your robotics article here. Tell us about your journey to Einstein...</p>",
    ydoc,
    provider
  });

  // Handle file selection from FileBrowserModal
  const handleFileSelect = (file: UploadedFile) => {
    if (!editor) return;
    const linkText = file.title || file.filename;
    const markdown = `[${linkText}](/api/files/download/${file.id})`;
    editor.commands.insertContent(markdown);
    setIsFileBrowserOpen(false);
  };

  // Use standard API query instead of custom useEntityFetch
  const { data: postRes, isLoading, isError } = useGetAdminPost(editSlug || "");

  useEffect(() => {
    if (postRes && postRes.post) {
      const post = postRes.post;
      form.setFieldValue("title", post.title || "");
      form.setFieldValue("publishedAt", post.publishedAt || "");
      form.setFieldValue("seasonId", post.seasonId ? Number(post.seasonId) : undefined);
      form.setFieldValue("thumbnail", post.thumbnail || DEFAULT_coverImage);
      form.setFieldValue("ast", post.ast ? JSON.parse(post.ast) : {});
      form.setFieldValue("socials", ((postRes as Record<string, unknown>).socials || {}) as { discord: boolean; bluesky: boolean; slack: boolean; teams: boolean; gchat: boolean; facebook: boolean; twitter: boolean; instagram: boolean; });
      if (editor && post.ast) {
        // In collaborative mode, avoid overwriting active live edits with the static DB snapshot.
        const shouldSetContent = !ydoc || ydoc.getXmlFragment("default").length === 0;

        if (shouldSetContent) {
          try {
            const parsed = JSON.parse(post.ast);
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed.content)) {
              try {
                editor.commands.setContent(parsed);
              } catch (renderErr) {
                console.error("Tiptap render error on AST", renderErr);
                editor.commands.setContent(`<p>${post.ast}</p>`);
              }
            } else {
              editor.commands.setContent(`<p>${post.ast}</p>`);
            }
          } catch (e) {
            console.error("Failed to parse existing AST", e);
            editor.commands.setContent(`<p>${post.ast}</p>`);
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
    onError: (err: unknown) => {
      toastApiError(err, "Publication failed");
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
    onError: (err: unknown) => {
      toastApiError(err, "Update failed");
    }
  });

  const deleteMutation = useDeletePost({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin_posts"] });
      navigate({ to: "/dashboard/manage_blog" });
    },
    onError: (err: unknown) => {
      toastApiError(err, "Failed to delete the post");
    }
  });

  const onFormSubmit = (isDraft = false) => {
    if (!editor) return;
    const ast = editor.getJSON();
    const formValue = form.state.values;
    const payload = { ...formValue, ast, isDraft, thumbnail: formValue.thumbnail === DEFAULT_coverImage ? "" : formValue.thumbnail };
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
    <div className="flex flex-col gap-6 w-full relative h-full">
      <div className="flex flex-col gap-6 flex-1 min-w-0">
        <form.Subscribe selector={(s) => [s.values.thumbnail, s.values.title, s.values.socials]}>
          {([thumbnailValue, titleValue, socialsValue]) => (
            <>
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
                  >
                    {(field) => (
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
                  </form.Field>
                </div>
                <div className="flex-1">
                  <CoverAssetPicker
                    label="Cover Image"
                    coverImage={thumbnailValue as string || DEFAULT_coverImage}
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
                  >
                    {(field) => (
                      <input
                        id="post-published-at" type="datetime-local"
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/30 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
                      />
                    )}
                  </form.Field>
                </div>
                <div className="flex-1 md:max-w-xs">
                  <form.Field
                    name="seasonId"
                  >
                    {(field) => (
                      <SeasonPicker value={(field.state.value as number | string) || ""} onChange={(val) => field.handleChange(val ? Number(val) : undefined)} />
                    )}
                  </form.Field>
                </div>
              </div>

              {/* ===== Unified Rich Editor ===== */}
              <div className="flex items-center gap-2">
                <div className="flex-1"><RichEditorToolbar editor={editor} documentTitle={titleValue as string} onInsertFileLink={() => setIsFileBrowserOpen(true)} /></div>
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

              {/* File Browser Modal */}
              <FileBrowserModal
                isOpen={isFileBrowserOpen}
                onClose={() => setIsFileBrowserOpen(false)}
                onSelect={handleFileSelect}
              />

              <EditorFooter
                errorMsg={uploadError || ""}
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
                    socials={socialsValue as Record<string, boolean>}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onChange={(platform, val) => form.setFieldValue(`socials.${platform}` as any, val)}
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

              {editSlug && postRes?.post && (
                <div className="w-full flex flex-col gap-6 mt-6">
                  <ZulipThread
                    stream={postRes.post.zulipStream || "blog"}
                    topic={postRes.post.zulipTopic || `Blog: ${postRes.post.title}`}
                  />
                </div>
              )}
            </>
          )}
        </form.Subscribe>
      </div>
    </div>
  );
}

export default function BlogEditor({ userRole }: { userRole?: string | unknown }) {
  const { editSlug } = useParams({ strict: false }) as Record<string, string>;

  const [draftId] = useState(() => `draft_blog_${crypto.randomUUID()}`);
  const roomId = editSlug ? `blog_${editSlug}` : draftId;

  return (
    <CollaborativeEditorRoom roomId={roomId}>
      <BlogEditorInner editSlug={editSlug} userRole={userRole} roomId={roomId} />
    </CollaborativeEditorRoom>
  );
}



