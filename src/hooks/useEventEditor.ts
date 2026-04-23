import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAdminSettings } from "./useAdminSettings";
import { useImageUpload } from "./useImageUpload";
import { eventSchema } from "../schemas/eventSchema";
import { adminApi } from "../api/adminApi";
import { publicApi } from "../api/publicApi";
import { useModal } from "../contexts/ModalContext";
import { DEFAULT_COVER_IMAGE } from "../utils/constants";
import { useEntityFetch } from "./useEntityFetch";
import type { Editor } from "@tiptap/react";

export interface LocationRow {
  id: string;
  name: string;
  address: string;
}

export interface EventData {
  id: string;
  title: string;
  date_start: string;
  date_end: string;
  location: string;
  description: string;
  cover_image: string;
  category: string;
  is_potluck: number;
  is_volunteer: number;
  is_deleted: number;
  status: string;
  revision_of?: string;
  published_at?: string;
  season_id?: string;
}

export function useEventEditor(editId: string | undefined, editor: Editor | null, userRole?: string | unknown) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const modal = useModal();
  
  const [errorMsg, setErrorMsg] = useState("");
  const [warningMsg, setWarningMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  
  const [socials, setSocials] = useState<Record<string, boolean>>({
    discord: true, bluesky: true, slack: false, teams: false, gchat: false, facebook: false, twitter: false, instagram: false
  });

  const { availableSocials } = useAdminSettings();
  const { uploadFile, isUploading, errorMsg: uploadError, setErrorMsg: setUploadError } = useImageUpload();

  const { data: locations = [] } = useQuery<LocationRow[]>({
    queryKey: ["locations"],
    queryFn: async () => {
      try {
        const d = await publicApi.get<{ locations?: LocationRow[] }>("/api/locations");
        return d.locations || [];
      } catch {
        return [];
      }
    }
  });

  const [isDeleted, setIsDeleted] = useState(false);
  const [form, setForm] = useState({
    title: "",
    dateStart: "",
    dateEnd: "",
    location: "",
    description: "",
    coverImage: DEFAULT_COVER_IMAGE,
    category: "internal" as "internal" | "outreach" | "external",
    tbaEventKey: "",
    isPotluck: false,
    isVolunteer: false,
    publishedAt: "",
    seasonId: "",
  });

  const handleFileUpload = async (file: File) => {
    try {
      setUploadError("");
      const { url } = await uploadFile(file);
      setForm((prev) => ({ ...prev, coverImage: url }));
    } catch(err) {
      setErrorMsg(uploadError || String(err));
    }
  };

  useEntityFetch<{ event?: EventData }>(
    editId ? `/api/admin/events/${editId}` : null,
    (data) => {
      if (data?.event) {
        setIsDeleted(data.event.is_deleted === 1);
        setForm({
          title: data.event.title || "",
          dateStart: data.event.date_start || "",
          dateEnd: data.event.date_end || "",
          location: data.event.location || "",
          description: data.event.description || "",
          coverImage: data.event.cover_image || DEFAULT_COVER_IMAGE,
          category: (data.event.category || "internal") as "internal" | "outreach" | "external",
          tbaEventKey: data.event.tba_event_key || "",
          isPotluck: data.event.is_potluck === 1,
          isVolunteer: data.event.is_volunteer === 1,
          publishedAt: data.event.published_at || "",
          seasonId: data.event.season_id || "",
        });
        if (editor) {
          try {
            editor.commands.setContent(JSON.parse(data.event.description));
          } catch {
            editor.commands.setContent(`<p>${data.event.description}</p>`);
          }
        }
      }
    }
  );

  const mutation = useMutation({
    mutationFn: async (isDraft: boolean) => {
      const finalDescription = editor ? JSON.stringify(editor.getJSON()) : form.description;
      const payload = { 
        ...form, 
        description: finalDescription, 
        isDraft,
        socials 
      };

      const payloadResult = eventSchema.safeParse(payload);
      if (!payloadResult.success) {
        throw new Error(payloadResult.error.issues[0].message);
      }

      const data = editId
        ? await adminApi.updateEvent(editId, payloadResult.data)
        : await adminApi.createEvent(payloadResult.data);
        
      if (!data.success) throw new Error(data.error || "Event save failed.");
      return data;
    },
    onSuccess: (data) => {
      const isAuthor = userRole === "author";
      const msg = editId 
        ? (isAuthor ? "Event update submitted for review!" : "Event updated successfully!")
        : (isAuthor ? "Event submitted for review!" : "Event published successfully!");
      setSuccessMsg(msg);
      setWarningMsg(data.warning || "");
      
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["admin_events"] });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["events"] }), 1500);

      if (!editId) {
        setForm({ 
          title: "", dateStart: "", dateEnd: "", location: "", 
          description: "", coverImage: DEFAULT_COVER_IMAGE, 
          category: "internal", tbaEventKey: "", isPotluck: false, 
          isVolunteer: false, publishedAt: "", seasonId: ""
        });
        if (editor) editor.commands.clearContent();
      }

      // Redirect if it's a draft or if the user is an author
      // We use a small timeout to let the success message be seen or just navigate immediately
      if (mutation.variables || userRole === "author") {
        navigate("/dashboard");
      }
    },
    onError: (err: unknown) => {
      setErrorMsg((err as Error).message || "Network error — could not reach the API.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const data = await adminApi.deleteEvent(id);
      if (!data.success) throw new Error(data.error || "Failed to delete event.");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["admin_events"] });
      navigate("/dashboard");
    },
    onError: () => {
      setErrorMsg("Failed to delete the event. Please try again.");
    }
  });

  const handleDelete = async () => {
    if (!editId || deleteMutation.isPending || mutation.isPending) return;
    const confirmed = await modal.confirm({
      title: "Delete Event",
      description: "Are you sure you want to permanently delete this event?",
      confirmText: "Delete",
      destructive: true,
    });
    if (!confirmed) return;

    setErrorMsg("");
    setWarningMsg("");
    setSuccessMsg("");
    deleteMutation.mutate(editId);
  };

  const handlePublish = (isDraft: boolean = false) => {
    if (mutation.isPending || deleteMutation.isPending) return;
    if (!form.title || !form.dateStart) {
      setErrorMsg("Title and Start Date are required.");
      return;
    }
    setErrorMsg("");
    setWarningMsg("");
    setSuccessMsg("");
    mutation.mutate(isDraft);
  };

  return {
    form,
    setForm,
    socials,
    setSocials,
    errorMsg,
    warningMsg,
    successMsg,
    isCoverPickerOpen,
    setIsCoverPickerOpen,
    isDeleted,
    locations,
    availableSocials,
    isUploading,
    isPending: mutation.isPending || deleteMutation.isPending,
    handleFileUpload,
    handleDelete,
    handlePublish,
  };
}
