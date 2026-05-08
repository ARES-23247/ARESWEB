import { useMemo } from "react";
import { useGetSettings } from "../api/settings";

// Configuration map for social platform requirements
const SOCIAL_PLATFORM_CONFIG = {
  discord: (cfg: Record<string, unknown>) => !!cfg.DISCORD_WEBHOOK_URL,
  bluesky: (cfg: Record<string, unknown>) => !!cfg.BLUESKY_HANDLE && !!cfg.BLUESKY_APP_PASSWORD,
  slack: (cfg: Record<string, unknown>) => !!cfg.SLACK_WEBHOOK_URL,
  teams: (cfg: Record<string, unknown>) => !!cfg.TEAMS_WEBHOOK_URL,
  gchat: (cfg: Record<string, unknown>) => !!cfg.GCHAT_WEBHOOK_URL,
  facebook: (cfg: Record<string, unknown>) => !!cfg.FACEBOOK_ACCESS_TOKEN,
  twitter: (cfg: Record<string, unknown>) => !!cfg.TWITTER_ACCESS_TOKEN,
  instagram: (cfg: Record<string, unknown>) => !!cfg.INSTAGRAM_ACCESS_TOKEN,
  zulip: (cfg: Record<string, unknown>) => !!cfg.ZULIP_BOT_EMAIL && !!cfg.ZULIP_API_KEY,
  band: (cfg: Record<string, unknown>) => !!cfg.BAND_ACCESS_TOKEN && !!cfg.BAND_KEY,
} as const;

export function useAdminSettings() {
  const { data: rawData, isLoading } = useGetSettings();

  const availableSocials = useMemo(() => {
    if (!rawData?.settings) return [];
    const config = rawData.settings;
    return Object.entries(SOCIAL_PLATFORM_CONFIG)
      .filter(([, checkFn]) => checkFn(config))
      .map(([platform]) => platform);
  }, [rawData?.settings]);

  return { availableSocials, isPending: isLoading };
}
