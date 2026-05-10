import { z } from "zod";
import { useState } from "react";
import { useForm } from "@tanstack/react-form";
// import { zodValidator } from "@tanstack/zod-form-adapter";
import {
  Calendar,
  Image as ImageIcon,
  Link as LinkIcon,
  Send,
  Trash2,
  Plus,
  X,
  AlertCircle,
} from "lucide-react";
import { format, addHours } from "date-fns";
import { useCreateSocialPost, type CreateSocialPostRequest } from "../../api/socialQueue";
import { toast } from "sonner";

// Social platform config with colors and icons
const PLATFORMS = {
  twitter: { name: "X (Twitter)", color: "bg-black", icon: "𝕏" },
  bluesky: { name: "Bluesky", color: "bg-social-bluesky", icon: "🦋" },
  facebook: { name: "Facebook", color: "bg-social-facebook", icon: "f" },
  instagram: { name: "Instagram", color: "bg-gradient-to-br from-purple-500 to-pink-500", icon: "📷" },
  discord: { name: "Discord", color: "bg-social-discord", icon: "💬" },
  slack: { name: "Slack", color: "bg-social-slack", icon: "💼" },
  teams: { name: "Teams", color: "bg-social-teams", icon: "👥" },
  gchat: { name: "Google Chat", color: "bg-social-googlechat", icon: "💬" },
  linkedin: { name: "LinkedIn", color: "bg-social-linkedin", icon: "in" },
  tiktok: { name: "TikTok", color: "bg-social-tiktok", icon: "🎵" },
  band: { name: "BAND", color: "bg-social-band", icon: "📢" },
} as const;

const socialComposerSchema = z.object({
  content: z.string().min(1, "Content is required").max(5000, "Content is too long"),
  scheduledFor: z.string().optional(),
  platforms: z.record(z.string(), z.boolean()).optional(),
  linkedType: z.enum(["blog", "event", "document", "asset"]).nullable().optional(),
  linkedId: z.string().optional(),
});

// type SocialComposerForm = z.infer<typeof socialComposerSchema>;

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
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaInput, setMediaInput] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  const form = useForm({
    // validatorAdapter: zodValidator(),
    defaultValues: {
      content: defaultContent,
      scheduledFor: undefined as string | undefined,
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
      linkedType: defaultLinkedType as "blog" | "event" | "document" | "asset" | null | undefined,
      linkedId: defaultLinkedId,
    },
    onSubmit: async ({ value }) => {
      const selectedPlatforms = Object.entries(value.platforms || {}).filter(([_, enabled]) => enabled);
      if (selectedPlatforms.length === 0) {
        toast.error("Please select at least one platform");
        return;
      }

      const scheduledFor = isScheduling && scheduledDate && scheduledTime
        ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
        : new Date().toISOString();

      const payload: CreateSocialPostRequest = {
        content: value.content,
        scheduledFor: scheduledFor,
        platforms: value.platforms || {},
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        linkedType: value.linkedType || undefined,
        linkedId: value.linkedId,
      };
      createMutation.mutate(payload);
    }
  });

  // Reactivity is now handled locally by form.Field and form.Subscribe where needed.

  const createMutation = useCreateSocialPost({
    onSuccess: () => {
      toast.success("Social post scheduled successfully!");
      form.reset();
      setMediaUrls([]);
      setIsScheduling(false);
      onClose?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to schedule post");
    },
  });

  const handleTogglePlatform = (platform: string, platformsState: Record<string, boolean> | undefined, handleChange: (val: Record<string, boolean>) => void) => {
    handleChange({
      ...platformsState,
      [platform]: !platformsState?.[platform]
    });
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
    form.setFieldValue("scheduledFor", tomorrow.toISOString());
  };

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
          <form.Field name="platforms">
            {(field) => {
              const platformsState = field.state.value;
              return (
                <>
                  {Object.entries(PLATFORMS).map(([key, config]) => {
                    const isEnabled = platformsState?.[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleTogglePlatform(key, platformsState, field.handleChange)}
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
                </>
              );
            }}
          </form.Field>
        </div>
      </div>

      <form.Field
        name="content"
        validators={{
          onChange: socialComposerSchema.shape.content,
        }}
      >
        {(field) => {
          const charCount = field.state.value?.length || 0;
          const charLimitWarning = charCount > 280;
          const charLimitError = charCount > 5000;
          return (
          <div className="space-y-2">
            <label htmlFor="social-content" className="text-xs font-bold text-marble/60 uppercase tracking-widest">
              Content
            </label>
            <textarea
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className={`w-full bg-white/5 border ${
                charLimitError ? "border-ares-red" : charLimitWarning ? "border-ares-gold" : "border-white/10"
              } ares-cut-sm px-4 py-3 text-white outline-none transition-colors min-h-[150px] resize-y`}
              placeholder="What would you like to share..."
            />
            <div className="flex items-center justify-between">
              <span className={`text-xs font-mono ${
                charLimitError ? "text-ares-red" : charLimitWarning ? "text-ares-gold" : "text-marble/60"
              }`}>
                {charCount.toLocaleString()} / 5,000
              </span>
              {charLimitWarning && (
                <span className="text-xs text-ares-gold flex items-center gap-1">
                  <AlertCircle size={12} />
                  Over 280 characters
                </span>
              )}
            </div>
            {field.state.meta.errors?.[0] && (
              <p className="text-xs text-ares-red font-bold uppercase">{field.state.meta.errors[0]?.message as string}</p>
            )}
          </div>
        )}}
      </form.Field>

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
              form.setFieldValue("scheduledFor", undefined);
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
                  form.setFieldValue("scheduledFor", new Date(`${e.target.value}T${scheduledTime}`).toISOString());
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
                  form.setFieldValue("scheduledFor", new Date(`${scheduledDate}T${e.target.value}`).toISOString());
                }
              }}
              className="bg-white/5 border border-white/10 ares-cut-sm px-3 py-2 text-white text-sm"
            />
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isDirty, state.values.platforms]}
      >
        {([canSubmit, isDirty, platforms]) => {
          const selectedPlatforms = Object.entries(platforms as Record<string, boolean> || {}).filter(([_, enabled]) => enabled);
          const hasSelectedPlatforms = selectedPlatforms.length > 0;
          return (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
              }}
              disabled={!canSubmit || !isDirty || !hasSelectedPlatforms || createMutation.isPending}
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
          );
        }}
      </form.Subscribe>
        <button
          type="button"
          onClick={() => {
            form.reset();
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
