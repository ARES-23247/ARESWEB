"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldAlert, Trophy } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { Tournament } from "@/types/tournament";
import {
  archiveTournament,
  createTournament,
  fetchTournaments,
  updateTournament,
} from "@/lib/tournamentApi";
import {
  TournamentForm,
  type TournamentFormSubmission,
} from "./tournaments/TournamentForm";
import { TournamentList } from "./tournaments/TournamentList";

export default function TournamentsManager() {
  const queryClient = useQueryClient();
  const { user, authorizedUser, loading: authLoading } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(
    null,
  );
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);

  const isAuthorized = useMemo(
    () =>
      Boolean(
        user &&
        authorizedUser &&
        ["admin", "coach"].includes(authorizedUser.role),
      ),
    [user, authorizedUser],
  );

  const {
    data: tournaments = [],
    isLoading: isListLoading,
    isError: isListError,
    error: listError,
    refetch: refetchList,
  } = useQuery<Tournament[]>({
    queryKey: ["tournaments"],
    queryFn: () => fetchTournaments(100),
    enabled: isAuthorized,
    staleTime: 30_000,
  });

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingTournament(null);
  };

  const saveMutation = useMutation({
    mutationFn: async ({ id, ...submission }: TournamentFormSubmission) => {
      const input = {
        name: submission.name,
        seasonName: submission.seasonName || undefined,
        challengeName: submission.challengeName || undefined,
        date: submission.date,
        location: submission.location,
        description: submission.description ?? undefined,
        status: submission.status,
        opr: submission.opr ?? 0,
        photoAlbumId: submission.photoAlbumId || undefined,
        scoutingDetails: submission.scoutingDetails
          ? {
              autoPathNotes:
                submission.scoutingDetails.autoPathNotes ?? undefined,
              driverFeedback:
                submission.scoutingDetails.driverFeedback ?? undefined,
              robotSpecs: submission.scoutingDetails.robotSpecs ?? undefined,
            }
          : undefined,
        oprList: submission.oprList ?? [],
      };
      return id ? updateTournament(id, input) : createTournament(input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      void queryClient.invalidateQueries({ queryKey: ["tournament"] });
      closeForm();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: archiveTournament,
    onSuccess: () => {
      setPendingArchiveId(null);
      void queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });

  const openCreateForm = () => {
    saveMutation.reset();
    setEditingTournament(null);
    setIsFormOpen(true);
  };

  const openEditForm = (tournament: Tournament) => {
    saveMutation.reset();
    setEditingTournament(tournament);
    setIsFormOpen(true);
  };

  if (authLoading) {
    return (
      <div className="flex flex-col justify-center items-center py-20 text-marble/55">
        <div className="w-8 h-8 border-2 border-ares-red/35 border-t-ares-red rounded-full animate-spin mb-4" />
        <span className="text-xs uppercase tracking-widest font-black">
          Loading administrative states...
        </span>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="p-8 bg-ares-red/5 border border-ares-red/20 rounded-2xl flex flex-col items-center justify-center text-center max-w-md mx-auto my-12">
        <ShieldAlert
          className="text-ares-gold w-12 h-12 mb-4 animate-pulse"
          aria-hidden="true"
        />
        <h2 className="text-lg font-bold text-white uppercase mb-2">
          Unauthorized Terminal Access
        </h2>
        <p className="text-xs text-marble/60 leading-relaxed">
          Tournament publishing and match changes require an administrator or
          coach account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-xl font-black uppercase text-white tracking-tight font-heading flex items-center gap-2">
            <Trophy className="text-ares-gold" size={22} aria-hidden="true" />
            Tournaments Log Manager
          </h2>
          <p className="text-xs text-marble/60 mt-1">
            Add, update, or soft-delete active tournaments and OPR leaderboards.
          </p>
        </div>

        {!isFormOpen && (
          <button
            type="button"
            onClick={openCreateForm}
            className="clipped-button bg-ares-red border border-ares-bronze/40 text-white font-black text-xs tracking-wider uppercase inline-flex items-center gap-2 py-2.5 px-6 self-start cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            <Plus size={14} aria-hidden="true" /> Add Tournament
          </button>
        )}
      </div>

      {isFormOpen && (
        <TournamentForm
          key={editingTournament?.id ?? "create"}
          tournament={editingTournament}
          isSaving={saveMutation.isPending}
          saveError={saveMutation.error}
          onClose={closeForm}
          onSubmit={(submission) => saveMutation.mutate(submission)}
        />
      )}

      <TournamentList
        tournaments={tournaments}
        isLoading={isListLoading}
        isError={isListError}
        error={listError}
        pendingArchiveId={pendingArchiveId}
        isArchiving={archiveMutation.isPending}
        archiveError={archiveMutation.error}
        onRetry={() => void refetchList()}
        onEdit={openEditForm}
        onRequestArchive={setPendingArchiveId}
        onCancelArchive={() => setPendingArchiveId(null)}
        onArchive={(id) => archiveMutation.mutate(id)}
      />
    </div>
  );
}
