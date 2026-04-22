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
    category: "internal",
    isPotluck: false,
    isVolunteer: false,
    publishedAt: "",
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

  useQuery({
    queryKey: ["event", editId],
    queryFn: async () => {
      if (!editId) return null;
      const data = await adminApi.get<{ event?: EventData }>(`/api/admin/events/${editId}`);
      if (data.event) {
        setIsDeleted(data.event.is_deleted === 1);
        setForm({
          title: data.event.title || "",
          dateStart: data.event.date_start || "",
          dateEnd: data.event.date_end || "",
          location: data.event.location || "",
          description: data.event.description || "",
          coverImage: data.event.cover_image || DEFAULT_COVER_IMAGE,
          category: data.event.category || "internal",
          isPotluck: data.event.is_potluck === 1,
          isVolunteer: data.event.is_volunteer === 1,
          publishedAt: data.event.published_at || "",
        });
        if (editor) {
          try {
            editor.commands.setContent(JSON.parse(data.event.description));
          } catch {
            editor.commands.setContent(`<p>${data.event.description}</p>`);
          }
        }
      }
      return data.event;
    },
    enabled: !!editId && !!editor,
  });

  const mutation = useMutation({
    mutationFn: async (isDraft: boolean) => {
      const finalDescription = editor ? JSON.stringify(editor.getJSON()) : form.description;
      const payload = { 
        ...form, 
        description: finalDescription, 
        isDraft,
        socials 
      };

      const parsed = eventSchema.parse(payload);
      const data = editId
        ? await adminApi.updateEvent(editId, parsed)
        : await adminApi.createEvent(parsed);
        
      if (!data.success) throw new Error(data.error || "Event save failed.");
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        setSuccessMsg(editId ? "Event updated successfully!" : "Event published successfully!");
        setWarningMsg(data.warning || "");
        
        queryClient.invalidateQueries({ queryKey: ["events"] });
        queryClient.invalidateQueries({ queryKey: ["admin_events"] });
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["events"] }), 1500);

        if (!editId) {
          setForm({ 
            title: "", dateStart: "", dateEnd: "", location: "", 
            description: "", coverImage: DEFAULT_COVER_IMAGE, 
            category: "internal", isPotluck: false, isVolunteer: false, publishedAt: "" 
          });
          if (editor) editor.commands.clearContent();
        }

        // Redirect if it's a draft or if the user is an author
        // We use a small timeout to let the success message be seen or just navigate immediately
        if (mutation.variables?.isDraft || userRole === "author") {
          navigate("/dashboard");
        }
      } else {
        setErrorMsg(data.error || "Failed to publish event");
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
    if (!editId) return;
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
