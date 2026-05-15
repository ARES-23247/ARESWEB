import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse, withMutationCallbacks } from "./honoClient";
import {
  tournamentSchema,
  tournamentPayloadSchema,
  tournamentMatchSchema,
  tournamentAwardSchema,
  tournamentAwardPayloadSchema,
} from "@shared/schemas/tournamentSchema";

export type Tournament = z.infer<typeof tournamentSchema>;
export type TournamentMatch = z.infer<typeof tournamentMatchSchema>;
export type TournamentAward = z.infer<typeof tournamentAwardSchema>;

export type CreateTournamentPayload = z.infer<typeof tournamentPayloadSchema>;
export type UpdateTournamentPayload = Partial<CreateTournamentPayload>;
export type CreateTournamentAwardPayload = z.infer<
  typeof tournamentAwardPayloadSchema
>;

export interface TournamentsResponse {
  tournaments: Tournament[];
}

export interface TournamentDetailResponse {
  tournament: Tournament;
  matches: TournamentMatch[];
  awards: TournamentAward[];
}

export function useGetTournaments(
  options?: Omit<UseQueryOptions<TournamentsResponse>, "queryKey" | "queryFn">,
) {
  return useQuery<TournamentsResponse>({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const response = await client.tournaments.$get();
      return unwrapResponse<TournamentsResponse>(response);
    },
    ...options,
  });
}

export function useGetTournament(
  id: string,
  options?: Omit<
    UseQueryOptions<TournamentDetailResponse>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<TournamentDetailResponse>({
    queryKey: ["tournaments", id],
    queryFn: async () => {
      const response = await client.tournaments[":id"].$get({ param: { id } });
      return unwrapResponse<TournamentDetailResponse>(response);
    },
    enabled: !!id,
    ...options,
  });
}

export function useCreateTournament(
  options?: Omit<
    UseMutationOptions<{ id: string }, Error, CreateTournamentPayload>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTournamentPayload) => {
      const response = await client.tournaments.$post({ json: payload });
      return unwrapResponse<{ id: string }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["tournaments"] });
      },
    }),
  });
}

export function useUpdateTournament(
  id: string,
  options?: Omit<
    UseMutationOptions<void, Error, UpdateTournamentPayload>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateTournamentPayload) => {
      const response = await client.tournaments[":id"].$patch({
        param: { id },
        json: payload as CreateTournamentPayload,
      });
      await unwrapResponse(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["tournaments"] });
        queryClient.invalidateQueries({ queryKey: ["tournaments", id] });
      },
    }),
  });
}

export function useDeleteTournament(
  options?: Omit<UseMutationOptions<void, Error, string>, "mutationFn">,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await client.tournaments[":id"].$delete({
        param: { id },
      });
      await unwrapResponse(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["tournaments"] });
      },
    }),
  });
}

export function useSyncTournamentMatches(
  id: string,
  options?: Omit<UseMutationOptions<void, Error, void>, "mutationFn">,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await client.tournaments[":id"]["sync-matches"].$post({
        param: { id },
      });
      await unwrapResponse(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["tournaments"] });
        queryClient.invalidateQueries({ queryKey: ["tournaments", id] });
      },
    }),
  });
}

export function useUpdateMatchVideo(
  tournamentId: string,
  options?: Omit<
    UseMutationOptions<
      void,
      Error,
      { matchId: string; youtubeVideoId: string | null }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ matchId, youtubeVideoId }) => {
      const response = await client.tournaments[":id"].matches[
        ":matchId"
      ].$patch({
        param: { id: tournamentId, matchId },
        json: { youtubeVideoId },
      });
      await unwrapResponse(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["tournaments"] });
        queryClient.invalidateQueries({
          queryKey: ["tournaments", tournamentId],
        });
      },
    }),
  });
}

export function useCreateTournamentAward(
  tournamentId: string,
  options?: Omit<
    UseMutationOptions<{ id: string }, Error, CreateTournamentAwardPayload>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTournamentAwardPayload) => {
      const response = await client.tournaments[":id"].awards.$post({
        param: { id: tournamentId },
        json: payload,
      });
      return unwrapResponse<{ id: string }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["tournaments"] });
        queryClient.invalidateQueries({
          queryKey: ["tournaments", tournamentId],
        });
      },
    }),
  });
}

export function useDeleteTournamentAward(
  tournamentId: string,
  options?: Omit<UseMutationOptions<void, Error, string>, "mutationFn">,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (awardId: string) => {
      const response = await client.tournaments[":id"].awards[
        ":awardId"
      ].$delete({
        param: { id: tournamentId, awardId },
      });
      await unwrapResponse(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["tournaments"] });
        queryClient.invalidateQueries({
          queryKey: ["tournaments", tournamentId],
        });
      },
    }),
  });
}
