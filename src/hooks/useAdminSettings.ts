import { useState, useEffect } from "react";
import { api } from "../api/client";

export function useAdminSettings() {
  const [availableSocials, setAvailableSocials] = useState<string[]>([]);
  const [isPending, setIsPending] = useState(true);

  const { data, isLoading } = api.settings.getSettings.useQuery({}, {
    queryKey: ["admin_settings_hook"],
  });

  useEffect(() => {
    if (data?.body?.settings) {
      const config = data.body.settings;
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailableSocials(available);
      setIsPending(false);
    } else if (!isLoading) {
      setIsPending(false);
    }
  }, [data, isLoading]);

  return { availableSocials, isPending };
}
