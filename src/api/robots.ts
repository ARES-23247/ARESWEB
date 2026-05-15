import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse, withMutationCallbacks } from "./honoClient";
import { robotSchema, robotPayloadSchema } from "@shared/schemas/robotSchema";

export type Robot = z.infer<typeof robotSchema>;
export type CreateRobotPayload = z.infer<typeof robotPayloadSchema>;
export type UpdateRobotPayload = Partial<CreateRobotPayload>;

export interface RobotsResponse {
  robots: Robot[];
}

export interface RobotResponse {
  robot: Robot;
}

export function useGetRobots(
  options?: Omit<UseQueryOptions<RobotsResponse>, "queryKey" | "queryFn">,
) {
  return useQuery<RobotsResponse>({
    queryKey: ["robots"],
    queryFn: async () => {
      const response = await client.robots.$get();
      return unwrapResponse<RobotsResponse>(response);
    },
    ...options,
  });
}

export function useGetRobot(
  id: string,
  options?: Omit<UseQueryOptions<RobotResponse>, "queryKey" | "queryFn">,
) {
  return useQuery<RobotResponse>({
    queryKey: ["robots", id],
    queryFn: async () => {
      const response = await client.robots[":id"].$get({ param: { id } });
      return unwrapResponse<RobotResponse>(response);
    },
    enabled: !!id,
    ...options,
  });
}

export function useCreateRobot(
  options?: Omit<
    UseMutationOptions<{ id: string }, Error, CreateRobotPayload>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateRobotPayload) => {
      const response = await client.robots.$post({ json: payload });
      const data = await unwrapResponse<{ id: string }>(response);
      return data;
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["robots"] });
      },
    }),
  });
}

export function useUpdateRobot(
  id: string,
  options?: Omit<
    UseMutationOptions<void, Error, UpdateRobotPayload>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateRobotPayload) => {
      const response = await client.robots[":id"].$patch({
        param: { id },
        json: payload as CreateRobotPayload,
      });
      await unwrapResponse(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["robots"] });
        queryClient.invalidateQueries({ queryKey: ["robots", id] });
      },
    }),
  });
}

export function useDeleteRobot(
  options?: Omit<UseMutationOptions<void, Error, string>, "mutationFn">,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await client.robots[":id"].$delete({ param: { id } });
      await unwrapResponse(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["robots"] });
      },
    }),
  });
}
