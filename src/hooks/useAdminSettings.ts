import { useState, useEffect } from "react";
import { adminApi } from "../api/adminApi";

export function useAdminSettings() {
  const [availableSocials, setAvailableSocials] = useState<string[]>([]);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await adminApi.get<{ success: boolean, settings: Record<string, string> }>("/api/admin/settings");
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
          if (config.ZULIP_BOT_EMAIL && config.ZULIP_API_KEY) available.push("zulip");
          setAvailableSocials(available);
        }
      } catch (err) {
        console.error("Failed to fetch available socials:", err);
      } finally {
        setIsPending(false);
      }
    };
    fetchSettings();
  }, []);

  return { availableSocials, isPending };
}
