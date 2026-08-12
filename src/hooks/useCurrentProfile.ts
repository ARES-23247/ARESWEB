import { useQuery } from "@tanstack/react-query";
import { authenticatedFetch } from "@/lib/api";

export interface CurrentProfilePayload {
  nickname: string;
  firstName: string;
  lastName: string;
  pronouns: string;
  avatar: string;
  bio: string;
  funFact: string;
  favoriteFirstThing: string;
  favoriteRobotMechanism: string;
  preMatchSuperstition: string;
  rookieYear: string;
  leadershipRole: string;
  subteams: string[];
  tshirtSize: string;
  dietaryRestrictions: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  phone: string;
  contactEmail: string;
  showEmail: boolean;
  showPhone: boolean;
  showOnAbout: boolean;
  colleges: Array<{ name: string; domain: string; years: string; degree: string }>;
  employers: Array<{ name: string; domain: string; title: string; current: boolean; years: string }>;
  memberType: string;
}

export interface CurrentProfileResponse {
  exists: boolean;
  profile: CurrentProfilePayload;
}

export const currentProfileQueryKey = (uid: string) => ["current-profile", uid] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function fetchCurrentProfile(signal?: AbortSignal): Promise<CurrentProfileResponse> {
  const response = await authenticatedFetch("/api/profiles/me", { signal });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = isRecord(payload) && typeof payload.error === "string" ? ` ${payload.error}` : "";
    throw new Error(`HTTP ${response.status}: ${response.statusText || "Request failed"}.${detail}`.trim());
  }

  if (!isRecord(payload) || typeof payload.exists !== "boolean" || !isRecord(payload.profile)) {
    throw new Error("The profile API returned an invalid response.");
  }

  return payload as unknown as CurrentProfileResponse;
}

export function useCurrentProfile(uid: string | undefined, enabled = true) {
  return useQuery({
    queryKey: currentProfileQueryKey(uid ?? "anonymous"),
    queryFn: ({ signal }) => fetchCurrentProfile(signal),
    enabled: enabled && Boolean(uid),
    staleTime: 5 * 60 * 1000,
  });
}
