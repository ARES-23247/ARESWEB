import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "../api";

export function useAdminSettings() {
  const [availableSocials, setAvailableSocials] = useState<string[]>([]);
  const [isPending, setIsPending] = useState(true);

  const { data: rawData, isLoading } = useQuery({
    queryKey: ["admin_settings_hook"],
    queryFn: () => fetchJson<{ settings: Record<string, string | undefined> }>("/api/settings")
  });

  useEffect(() => {
    if (rawData?.settings) {
      const config = rawData.settings;
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
      if (config.BAND_ACCESS_TOKEN && config.BAND_KEY) available.push("band");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailableSocials(available);
      setIsPending(false);
    } else if (!isLoading) {
      setIsPending(false);
    }
  }, [rawData, isLoading]);

  return { availableSocials, isPending };
}
