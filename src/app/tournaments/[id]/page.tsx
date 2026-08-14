"use client";

import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Trophy } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import SEO from "@/components/SEO";
import { GreekMeander } from "@/components/GreekMeander";
import { PublicDataState } from "@/components/PublicDataState";
import type { Tournament, TournamentMatch } from "@/types/tournament";
import TournamentMatchesList from "./TournamentMatchesList";
import {
  archiveTournamentMatch,
  createTournamentMatch,
  fetchTournament,
  fetchTournamentMatches,
  setTournamentMatchCompletion,
  TournamentApiError,
  updateTournamentMatch,
} from "@/lib/tournamentApi";
import { authenticatedFetch } from "@/lib/api";
import { apiFailure, type ManagedPhoto } from "@/lib/media";
import {
  TournamentAnalyticsSidebar,
  TournamentHero,
  TournamentPhotoLightbox,
  TournamentPhotosSection,
  TournamentScoutingSection,
  type TournamentPhoto,
} from "./TournamentDetailSections";

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user, authorizedUser, loading: authLoading } = useAuth();
  const [activeLightboxImage, setActiveLightboxImage] =
    useState<TournamentPhoto | null>(null);
  const [mutationError, setMutationError] = useState<Error | null>(null);

  const isAuthorized = useMemo(
    () =>
      Boolean(user && authorizedUser && authorizedUser.role !== "unverified"),
    [user, authorizedUser],
  );
  const canEdit = useMemo(
    () =>
      Boolean(
        user &&
        authorizedUser &&
        ["admin", "coach"].includes(authorizedUser.role),
      ),
    [user, authorizedUser],
  );

  const {
    data: tournament,
    isLoading: isTournamentLoading,
    isError: isTournamentError,
    error: tournamentError,
    refetch: refetchTournament,
  } = useQuery<Tournament>({
    queryKey: ["tournament", id],
    queryFn: async () => {
      if (!id) throw new Error("Tournament route is missing an ID");
      return fetchTournament(id);
    },
    enabled: isAuthorized && Boolean(id),
    staleTime: 60_000,
  });

  const {
    data: matches = [],
    isLoading: isMatchesLoading,
    isError: isMatchesError,
    error: matchesError,
    refetch: refetchMatches,
  } = useQuery<TournamentMatch[]>({
    queryKey: ["tournament_matches", id],
    queryFn: async () => (id ? fetchTournamentMatches(id, 250) : []),
    enabled: isAuthorized && Boolean(id),
    staleTime: 30_000,
  });

  const {
    data: photos = [],
    isError: isPhotosError,
    error: photosError,
    refetch: refetchPhotos,
  } = useQuery<TournamentPhoto[]>({
    queryKey: ["tournament_photos", tournament?.photoAlbumId],
    queryFn: async () => {
      if (!tournament?.photoAlbumId) return [];
      const response = await authenticatedFetch(
        `/api/photos?albumId=${encodeURIComponent(tournament.photoAlbumId)}&limit=50`,
      );
      if (!response.ok)
        throw await apiFailure(response, "Tournament photos could not load.");
      const payload = (await response.json()) as { photos: ManagedPhoto[] };
      return payload.photos
        .map((photo) => ({
          src: photo.publicUrl,
          previewSrc: photo.thumbnailUrl ?? undefined,
          caption: photo.caption,
        }))
        .filter((photo) => photo.src);
    },
    enabled: Boolean(tournament?.photoAlbumId),
  });

  const handleMutationError = (error: Error) => {
    setMutationError(error);
    void refetchMatches();
  };
  const handleMutationSuccess = () => {
    setMutationError(null);
    void queryClient.invalidateQueries({
      queryKey: ["tournament_matches", id],
    });
  };

  const toggleMatchMutation = useMutation({
    mutationFn: async ({
      match,
      completed,
    }: {
      match: TournamentMatch;
      completed: boolean;
    }) => {
      if (!id) throw new Error("Tournament route is missing an ID");
      return setTournamentMatchCompletion(
        id,
        match.id,
        completed,
        match.updatedAt ?? null,
      );
    },
    onSuccess: handleMutationSuccess,
    onError: handleMutationError,
  });

  const addMatchMutation = useMutation({
    mutationFn: async (newMatch: Partial<TournamentMatch>) => {
      if (!id) throw new Error("Tournament route is missing an ID");
      return createTournamentMatch(id, {
        matchNumber: newMatch.matchNumber ?? "",
        alliance: newMatch.alliance ?? "red",
        partner: newMatch.partner ?? "TBD",
        opponents: newMatch.opponents ?? ["TBD"],
        scoreSelf: newMatch.scoreSelf ?? undefined,
        scoreOpponent: newMatch.scoreOpponent ?? undefined,
        result: newMatch.result ?? "upcoming",
        completed: newMatch.completed ?? false,
        notes: newMatch.notes ?? undefined,
      });
    },
    onSuccess: handleMutationSuccess,
    onError: handleMutationError,
  });

  const updateMatchMutation = useMutation({
    mutationFn: async (updated: Partial<TournamentMatch> & { id: string }) => {
      if (!id) throw new Error("Tournament route is missing an ID");
      return updateTournamentMatch(id, updated.id, {
        matchNumber: updated.matchNumber,
        alliance: updated.alliance,
        partner: updated.partner,
        opponents: updated.opponents,
        scoreSelf: updated.scoreSelf,
        scoreOpponent: updated.scoreOpponent,
        result: updated.result,
        completed: updated.completed,
        notes: updated.notes ?? undefined,
        expectedUpdatedAt: updated.updatedAt ?? null,
      });
    },
    onSuccess: handleMutationSuccess,
    onError: handleMutationError,
  });

  const deleteMatchMutation = useMutation({
    mutationFn: async (match: TournamentMatch) => {
      if (!id) throw new Error("Tournament route is missing an ID");
      return archiveTournamentMatch(id, match.id, match.updatedAt ?? null);
    },
    onSuccess: handleMutationSuccess,
    onError: handleMutationError,
  });

  if (authLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] bg-obsidian text-marble">
        <div className="w-10 h-10 border-4 border-ares-red/35 border-t-ares-red rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest text-ares-gold/85 animate-pulse font-heading">
          Connecting Data Nodes...
        </p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="w-full min-h-screen bg-obsidian text-marble py-8 flex flex-col justify-center relative overflow-hidden">
        <SEO
          title="Sign In | ARES Scouting Vault"
          description="Authorized authentication required to access team scouting records."
          noindex={true}
        />
        <div className="absolute top-0 left-0 w-full z-10">
          <GreekMeander
            variant="thin"
            opacity="opacity-30"
            className="w-full"
          />
        </div>
        <div className="w-full max-w-md mx-auto px-6 z-10">
          <div className="glass-card hero-card p-8 border border-white/10 bg-black/60 shadow-2xl flex flex-col items-center text-center">
            <AlertCircle
              className="text-ares-gold w-12 h-12 mb-4 animate-bounce"
              aria-hidden="true"
            />
            <h2 className="text-xl font-bold uppercase tracking-tight text-white mb-2">
              Access Gated
            </h2>
            <p className="text-xs text-marble/60 mb-6">
              You must log in to view tournament matches, scouting reports, and
              OPR logs.
            </p>
            <Link
              to="/tournaments"
              className="clipped-button bg-ares-red text-white uppercase text-xs w-full py-2"
            >
              Back to Tournaments
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isTournamentLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] bg-obsidian text-marble">
        <div className="w-8 h-8 border-2 border-ares-red/35 border-t-ares-red rounded-full animate-spin mb-4" />
        <p className="text-xs uppercase tracking-widest font-black text-marble/60">
          Fetching Tournament Record...
        </p>
      </div>
    );
  }

  if (isTournamentError) {
    const isNotFound =
      tournamentError instanceof TournamentApiError &&
      tournamentError.status === 404;
    return (
      <div className="min-h-screen w-full bg-obsidian px-6 py-24 text-marble">
        <div className="mx-auto max-w-3xl">
          {isNotFound ? (
            <div className="text-center p-8 hero-card bg-white/5 border border-white/10">
              <Trophy
                size={48}
                className="mx-auto text-ares-gold mb-4"
                aria-hidden="true"
              />
              <h1 className="text-xl font-bold text-white uppercase mb-2">
                Record Not Found
              </h1>
              <p className="text-xs text-marble/60 mb-6">
                The tournament record may have been archived or the link may be
                out of date.
              </p>
              <Link
                to="/tournaments"
                className="clipped-button bg-ares-red text-white uppercase text-xs py-2 px-6"
              >
                Back to List
              </Link>
            </div>
          ) : (
            <PublicDataState
              title="Unable to load this tournament"
              message="The scouting record could not be reached. Check your connection or sign in again, then retry."
              diagnostic={
                tournamentError instanceof Error
                  ? tournamentError.message
                  : String(tournamentError)
              }
              onRetry={() => void refetchTournament()}
            />
          )}
        </div>
      </div>
    );
  }

  if (!tournament) return null;

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <SEO
        title={`${tournament.name} | Scouting & Analytics`}
        description={`Match results, OPR values, and technical scouting logs for ARES at the ${tournament.name}.`}
        noindex={true}
      />
      <div className="w-full max-w-7xl mx-auto px-6 py-12">
        <Link
          to="/tournaments"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-marble/60 hover:text-ares-gold transition-colors mb-8 group"
        >
          <ArrowLeft
            size={14}
            className="group-hover:-translate-x-1 transition-transform"
            aria-hidden="true"
          />
          Back to scouting list
        </Link>

        <TournamentHero tournament={tournament} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {isMatchesError && (
              <PublicDataState
                title="Unable to load match records"
                message={
                  matches.length > 0
                    ? "The last confirmed match list is still shown below, but its refresh failed."
                    : "Tournament details are available, but the match checklist could not be reached."
                }
                diagnostic={
                  matchesError instanceof Error
                    ? matchesError.message
                    : String(matchesError)
                }
                onRetry={() => void refetchMatches()}
              />
            )}
            {mutationError && (
              <div
                role="status"
                className="rounded-xl border border-ares-red/40 bg-ares-red/10 p-4 text-sm text-white"
              >
                <p className="font-bold">
                  {mutationError instanceof TournamentApiError &&
                  mutationError.status === 409
                    ? "That match changed on another device. The latest record has been loaded; compare it with your preserved draft before saving again."
                    : mutationError instanceof TournamentApiError &&
                        mutationError.status === 404
                      ? "That match was changed or archived elsewhere. The list has been refreshed."
                      : "The match change was not saved. Your confirmed data is unchanged."}
                </p>
                <p className="mt-1 font-mono text-xs text-marble/80">
                  {mutationError.message}
                </p>
                <button
                  type="button"
                  onClick={() => setMutationError(null)}
                  className="mt-3 rounded border border-white/20 px-3 py-1 text-xs font-bold uppercase focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  Dismiss
                </button>
              </div>
            )}
            {(!isMatchesError || matches.length > 0) && (
              <TournamentMatchesList
                isPast={tournament.status === "past"}
                matches={matches}
                canEdit={canEdit}
                isMatchesLoading={isMatchesLoading}
                isSavingMatch={
                  toggleMatchMutation.isPending ||
                  addMatchMutation.isPending ||
                  updateMatchMutation.isPending ||
                  deleteMatchMutation.isPending
                }
                onToggleMatch={(match, completed) =>
                  toggleMatchMutation.mutate({ match, completed })
                }
                onAddMatch={async (newMatch) => {
                  await addMatchMutation.mutateAsync(newMatch);
                }}
                onUpdateMatch={async (updated) => {
                  await updateMatchMutation.mutateAsync(updated);
                }}
                onDeleteMatch={async (match) => {
                  await deleteMatchMutation.mutateAsync(match);
                }}
              />
            )}

            <TournamentScoutingSection tournament={tournament} />
            <TournamentPhotosSection
              hasAlbum={Boolean(tournament.photoAlbumId)}
              photos={photos}
              isError={isPhotosError}
              error={photosError}
              onRetry={() => void refetchPhotos()}
              onOpenPhoto={setActiveLightboxImage}
            />
          </div>

          <TournamentAnalyticsSidebar tournament={tournament} />
        </div>
      </div>

      <TournamentPhotoLightbox
        photo={activeLightboxImage}
        onClose={() => setActiveLightboxImage(null)}
      />
    </div>
  );
}
