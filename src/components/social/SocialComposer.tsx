import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Calendar,
  Image as ImageIcon,
  Link as LinkIcon,
  Send,
  Trash2,
  Plus,
  X,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { format, addHours } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "../../utils/apiClient";
import { toast } from "sonner";

// Social platform config with colors and icons
const PLATFORMS = {
  twitter: { name: "X (Twitter)", color: "bg-black", icon: "𝕏" },
  bluesky: { name: "Bluesky", color: "bg-[#0085ff]", icon: "🦋" },
  facebook: { name: "Facebook", color: "bg-[#1877F2]", icon: "f" },
  instagram: { name: "Instagram", color: "bg-gradient-to-br from-purple-500 to-pink-500", icon: "📷" },
  discord: { name: "Discord", color: "bg-[#5865F2]", icon: "💬" },
  slack: { name: "Slack", color: "bg-[#4A154B]", icon: "💼" },
  teams: { name: "Teams", color: "bg-[#6264A7]", icon: "👥" },
  gchat: { name: "Google Chat", color: "bg-[#00897B]", icon: "💬" },
  linkedin: { name: "LinkedIn", color: "bg-[#0077b5]", icon: "in" },
  tiktok: { name: "TikTok", color: "bg-[#00f2ea]", icon: "🎵" },
  band: { name: "BAND", color: "bg-[#2D6CD4]", icon: "📢" },
} as const;

const socialComposerSchema = z.object({
  content: z.string().min(1, "Content is required").max(5000, "Content is too long"),
  scheduled_for: z.string().optional(),
  platforms: z.record(z.string(), z.boolean()).optional(),
  linked_type: z.enum(["blog", "event", "document", "asset"]).nullable().optional(),
  linked_id: z.string().optional(),
});

type SocialComposerForm = z.infer<typeof socialComposerSchema>;

interface SocialComposerProps {
  onClose?: () => void;
  defaultContent?: string;
  defaultLinkedType?: "blog" | "event" | "document" | "asset";
  defaultLinkedId?: string;
  defaultLinkedTitle?: string;
}

export default function SocialComposer({
  onClose,
  defaultContent = "",
  defaultLinkedType,
  defaultLinkedId,
  defaultLinkedTitle,
}: SocialComposerProps) {
  const queryClient = useQueryClient();
  const [characterCount, setCharacterCount] = useState(0);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaInput, setMediaInput] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<SocialComposerForm>({
    resolver: zodResolver(socialComposerSchema),
    defaultValues: {
      content: defaultContent,
      scheduled_for: undefined,
      platforms: {
        twitter: true,
        bluesky: true,
        facebook: false,
        instagram: false,
        discord: true,
        slack: false,
        teams: false,
        gchat: false,
        linkedin: false,
        tiktok: false,
        band: false,
      } as Record<string, boolean>,
      linked_type: defaultLinkedType,
      linked_id: defaultLinkedId,
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const content = watch("content");
  const platforms = watch("platforms");

  useEffect(() => {
    setCharacterCount(content?.length || 0);
  }, [content]);

  const createMutation = useMutation({
    mutationFn: async (data: {
      content: string;
      scheduled_for: string;
      platforms: Record<string, boolean>;
      media_urls?: string[];
      linked_type?: string | null;
      linked_id?: string;
    }) => {
      return fetchJson("/api/social-queue", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast.success("Social post scheduled successfully!");
      queryClient.invalidateQueries({ queryKey: ["social-queue"] });
      queryClient.invalidateQueries({ queryKey: ["social-queue", "calendar"] });
      reset();
      setMediaUrls([]);
      setIsScheduling(false);
      onClose?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to schedule post");
    },
  });

  const selectedPlatforms = Object.entries(platforms || {}).filter(([_, enabled]) => enabled);
  const hasSelectedPlatforms = selectedPlatforms.length > 0;

  const handleTogglePlatform = (platform: string) => {
    setValue(`platforms.${platform}`, !platforms?.[platform], { shouldDirty: true });
  };

  const handleAddMedia = () => {
    if (mediaInput.trim() && mediaUrls.length < 4) {
      setMediaUrls([...mediaUrls, mediaInput.trim()]);
      setMediaInput("");
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaUrls(mediaUrls.filter((_, i) => i !== index));
  };

  const handleScheduleLater = () => {
    setIsScheduling(true);
    const tomorrow = addHours(new Date(), 24);
    setScheduledDate(format(tomorrow, "yyyy-MM-dd"));
    setScheduledTime(format(tomorrow, "HH:mm"));
    setValue("scheduled_for", tomorrow.toISOString(), { shouldDirty: true });
  };

  const onSubmit = (data: SocialComposerForm) => {
    if (!hasSelectedPlatforms) {
      toast.error("Please select at least one platform");
      return;
    }

    const scheduledFor = isScheduling && scheduledDate && scheduledTime
      ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
      : new Date().toISOString();

    createMutation.mutate({
      content: data.content,
      scheduled_for: scheduledFor,
      platforms: platforms || {},
      media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
      linked_type: data.linked_type,
      linked_id: data.linked_id,
    });
  };

  const characterLimitWarning = characterCount > 280;
  const characterLimitError = characterCount > 5000;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-end">
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-marble/60 hover:text-white hover:bg-white/10 ares-cut-sm transition-all"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Linked Content Indicator */}
      {defaultLinkedType && defaultLinkedId && (
        <div className="bg-ares-cyan/10 border border-ares-cyan/30 ares-cut-sm p-3 flex items-center gap-2">
          <LinkIcon className="text-ares-cyan" size={16} />
          <span className="text-sm text-ares-cyan">
            Linked to {defaultLinkedType}: {defaultLinkedTitle || defaultLinkedId}
          </span>
        </div>
      )}

      {/* Platform Selection */}
      <div className="bg-obsidian/50 border border-white/10 ares-cut-sm p-4">
        <div className="text-xs font-bold text-marble/60 uppercase tracking-widest mb-3">
          Select Platforms
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {Object.entries(PLATFORMS).map(([key, config]) => {
            const isEnabled = platforms?.[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleTogglePlatform(key)}
                className={`px-3 py-3 ares-cut-sm text-sm font-bold transition-all flex flex-col items-center gap-1 ${
                  isEnabled
                    ? `${config.color} text-white shadow-lg`
                    : "bg-white/5 text-marble/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <span className="text-lg">{config.icon}</span>
                <span className="text-xs">{config.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Input */}
      <div className="space-y-2">
        <label htmlFor="social-content" className="text-xs font-bold text-marble/60 uppercase tracking-widest">
          Content
        </label>
        <textarea
          id="social-content"
          {...register("content")}
          className={`w-full bg-white/5 border ${
            characterLimitError ? "border-ares-red" : characterLimitWarning ? "border-ares-gold" : "border-white/10"
          } ares-cut-sm px-4 py-3 text-white outline-none transition-colors min-h-[150px] resize-y`}
          placeholder="What would you like to share..."
        />
        <div className="flex items-center justify-between">
          <span className={`text-xs font-mono ${
            characterLimitError ? "text-ares-red" : characterLimitWarning ? "text-ares-gold" : "text-marble/60"
          }`}>
            {characterCount.toLocaleString()} / 5,000
          </span>
          {characterLimitWarning && (
            <span className="text-xs text-ares-gold flex items-center gap-1">
              <AlertCircle size={12} />
              Over 280 characters
            </span>
          )}
        </div>
        {errors.content && (
          <p className="text-xs text-ares-red font-bold uppercase">{errors.content.message}</p>
        )}
      </div>

      {/* Media Attachments */}
      <div className="space-y-2">
        <label htmlFor="media-url-input" className="text-xs font-bold text-marble/60 uppercase tracking-widest flex items-center gap-2">
          <ImageIcon size={14} />
          Media URLs (max 4)
        </label>
        <div className="flex gap-2">
          <input
            id="media-url-input"
            type="url"
            value={mediaInput}
            onChange={(e) => setMediaInput(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="flex-1 bg-white/5 border border-white/10 ares-cut-sm px-4 py-2 text-white outline-none focus:border-ares-cyan transition-colors text-sm"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddMedia())}
          />
          <button
            type="button"
            onClick={handleAddMedia}
            disabled={mediaUrls.length >= 4 || !mediaInput.trim()}
            className="px-4 py-2 bg-ares-cyan text-black font-bold ares-cut-sm hover:bg-ares-cyan/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
        {mediaUrls.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {mediaUrls.map((url, index) => (
              <div
                key={index}
                className="bg-white/5 border border-white/10 ares-cut-sm px-3 py-1.5 flex items-center gap-2 text-sm text-white"
              >
                <span className="truncate max-w-[200px]">{url}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveMedia(index)}
                  className="text-marble/60 hover:text-ares-red transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scheduling */}
      <div className="bg-white/5 border border-white/10 ares-cut-sm p-4">
        <div className="text-xs font-bold text-marble/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Calendar size={14} />
          Schedule
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setIsScheduling(false);
              setValue("scheduled_for", undefined);
            }}
            className={`px-4 py-2 ares-cut-sm text-sm font-bold transition-all ${
              !isScheduling
                ? "bg-ares-cyan text-black"
                : "bg-white/5 text-marble/60 hover:text-white"
            }`}
          >
            Send Now
          </button>
          <button
            type="button"
            onClick={handleScheduleLater}
            className={`px-4 py-2 ares-cut-sm text-sm font-bold transition-all ${
              isScheduling && scheduledDate
                ? "bg-ares-cyan text-black"
                : "bg-white/5 text-marble/60 hover:text-white"
            }`}
          >
            Schedule for Later
          </button>
        </div>
        {isScheduling && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => {
                setScheduledDate(e.target.value);
                if (scheduledTime) {
                  setValue("scheduled_for", new Date(`${e.target.value}T${scheduledTime}`).toISOString());
                }
              }}
              className="bg-white/5 border border-white/10 ares-cut-sm px-3 py-2 text-white text-sm"
            />
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => {
                setScheduledTime(e.target.value);
                if (scheduledDate) {
                  setValue("scheduled_for", new Date(`${scheduledDate}T${e.target.value}`).toISOString());
                }
              }}
              className="bg-white/5 border border-white/10 ares-cut-sm px-3 py-2 text-white text-sm"
            />
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit(onSubmit)}
          disabled={!isValid || !isDirty || !hasSelectedPlatforms || createMutation.isPending}
          className="flex-1 py-3 bg-gradient-to-r from-ares-gold to-yellow-600 text-black font-bold ares-cut hover:shadow-[0_0_30px_rgba(255,191,0,0.3)] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {createMutation.isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
              Scheduling...
            </>
          ) : (
            <>
              <Send size={18} />
              {isScheduling ? "Schedule Post" : "Send Now"}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setMediaUrls([]);
            setIsScheduling(false);
          }}
          className="px-4 py-3 bg-white/5 text-marble/60 font-bold ares-cut hover:text-white transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
