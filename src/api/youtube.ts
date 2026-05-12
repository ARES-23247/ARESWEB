import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client, unwrapResponse } from "./honoClient";

export function useGetYoutubeAuthStatus() {
  return useQuery({
    queryKey: ["youtube", "authStatus"],
    queryFn: async () => {
      const res = await client.youtube.status.$get();
      return unwrapResponse<{ isAuthenticated: boolean }>(res);
    },
  });
}

export function useGetYoutubeAuthUrl() {
  return useQuery({
    queryKey: ["youtube", "authUrl"],
    queryFn: async () => {
      const res = await client.youtube["auth-url"].$get();
      return unwrapResponse<{ url: string }>(res);
    },
  });
}

export function useGetYoutubeVideos() {
  return useQuery({
    queryKey: ["youtube", "videos"],
    queryFn: async () => {
      const res = await client.youtube.videos.$get();
      return unwrapResponse<{ videos: Array<{ id: string; title: string; description: string; thumbnailUrl?: string; privacyStatus: "public" | "unlisted" | "private"; publishedAt: string }> }>(res);
    },
  });
}

export function useGetYoutubeResumableUrlMutation() {
  return useMutation({
    mutationFn: async (payload: { title: string; description: string; privacyStatus: "public" | "unlisted" | "private" }) => {
      const res = await client.youtube["resumable-url"].$post({ json: payload });
      return unwrapResponse<{ uploadUrl: string }>(res);
    },
  });
}

export function useUpdateYoutubeVideoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; title?: string; description?: string; privacyStatus?: "public" | "unlisted" | "private" }) => {
      const res = await client.youtube.videos[":id"].$put({
        param: { id },
        json: payload,
      });
      return unwrapResponse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["youtube", "videos"] });
    },
  });
}
