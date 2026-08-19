"use client";

import { useCallback, useEffect, useState } from "react";
import { Award, CalendarRange, Edit2, Plus, RefreshCw, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { logger } from "@/utils/logger";

interface SeasonRecord {
  id: string;
  startYear: number;
  endYear: number | null;
  challengeName: string;
  robotName: string | null;
  summary: string | null;
  status: "published" | "draft";
  isDeleted?: number;
}

interface AwardRecord {
  id: string;
  title: string;
  eventName: string;
  date: string;
  description: string | null;
  iconType: string;
  seasonId: string | null;
  status: "published" | "draft";
  isDeleted?: number;
}

interface SeasonForm {
  id: string | null;
  startYear: string;
  endYear: string;
  challengeName: string;
  robotName: string;
  summary: string;
  status: "published" | "draft";
}

interface AwardForm {
  id: string | null;
  title: string;
  eventName: string;
  date: string;
  description: string;
  seasonId: string;
  status: "published" | "draft";
}

const EMPTY_SEASON: SeasonForm = {
  id: null, startYear: String(new Date().getFullYear()), endYear: "",
  challengeName: "", robotName: "", summary: "", status: "published",
};

const EMPTY_AWARD: AwardForm = {
  id: null, title: "", eventName: "", date: "", description: "",
  seasonId: "", status: "published",
};

async function apiJson(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await authenticatedFetch(path, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof (payload as { error?: unknown }).error === "string"
      ? (payload as { error: string }).error
      : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as Record<string, unknown>;
}

export default function SeasonsAwardsManagerPage() {
  const { authorizedUser } = useAuth();
  const [seasons, setSeasons] = useState<SeasonRecord[]>([]);
  const [awards, setAwards] = useState<AwardRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seasonForm, setSeasonForm] = useState<SeasonForm | null>(null);
  const [awardForm, setAwardForm] = useState<AwardForm | null>(null);

  const canManage = ["admin", "coach", "mentor"].includes(authorizedUser?.role ?? "");

  const reload = useCallback(async () => {
    setIsLoading(true);
    setListError(null);
    try {
      const [seasonPayload, awardPayload] = await Promise.all([
        apiJson("/api/seasons/admin"),
        apiJson("/api/awards/admin"),
      ]);
      setSeasons((seasonPayload.seasons as SeasonRecord[] | undefined) ?? []);
      setAwards((awardPayload.awards as AwardRecord[] | undefined) ?? []);
    } catch (error) {
      logger.error("Failed to load seasons/awards:", error);
      setListError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) void reload();
  }, [canManage, reload]);

  const saveSeason = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!seasonForm) return;
    setSaving(true);
    setOperationError(null);
    try {
      await apiJson("/api/seasons/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: seasonForm.id ?? undefined,
          startYear: Number(seasonForm.startYear),
          endYear: seasonForm.endYear ? Number(seasonForm.endYear) : null,
          challengeName: seasonForm.challengeName,
          robotName: seasonForm.robotName || undefined,
          summary: seasonForm.summary || undefined,
          status: seasonForm.status,
        }),
      });
      setSeasonForm(null);
      await reload();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const saveAward = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!awardForm) return;
    setSaving(true);
    setOperationError(null);
    try {
      await apiJson("/api/awards/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: awardForm.id ?? undefined,
          title: awardForm.title,
          eventName: awardForm.eventName,
          date: awardForm.date,
          description: awardForm.description || undefined,
          seasonId: awardForm.seasonId || undefined,
          status: awardForm.status,
        }),
      });
      setAwardForm(null);
      await reload();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const setLifecycle = async (family: "seasons" | "awards", id: string, archive: boolean) => {
    setOperationError(null);
    try {
      await apiJson(
        `/api/${family}/admin/${encodeURIComponent(id)}${archive ? "" : "/restore"}`,
        { method: archive ? "DELETE" : "PATCH" },
      );
      await reload();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    }
  };

  if (!canManage) {
    return (
      <div className="border border-ares-gold/30 bg-ares-gold/10 p-6 text-marble">
        Only an admin, coach, or mentor can manage seasons and awards.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-black uppercase text-white">
            Seasons &amp; Awards
          </h1>
          <p className="mt-1 text-sm text-marble/70">
            Maintain the public team legacy timeline without touching the Firestore console.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="inline-flex min-h-11 items-center gap-2 border border-white/20 px-4 py-2 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </header>

      {listError && (
        <p role="alert" className="border border-ares-red/40 bg-ares-red/10 p-4 text-sm text-marble">
          Seasons and awards are unavailable: {listError}
        </p>
      )}
      {operationError && (
        <p role="alert" className="border border-ares-red/40 bg-ares-red/10 p-4 text-sm text-marble">
          {operationError}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-marble/60" role="status">Loading seasons and awards…</p>
      ) : listError ? null : (
        <>
          <section className="border border-white/10 bg-black/25 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="inline-flex items-center gap-2 font-heading text-xl font-black uppercase text-white">
                <CalendarRange size={18} className="text-ares-gold" aria-hidden="true" /> Seasons
              </h2>
              <button
                type="button"
                onClick={() => setSeasonForm({ ...EMPTY_SEASON })}
                className="inline-flex min-h-11 items-center gap-2 bg-ares-red px-4 py-2 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <Plus size={14} aria-hidden="true" /> New season
              </button>
            </div>

            {seasonForm && (
              <form onSubmit={saveSeason} className="mt-4 space-y-3 border border-white/10 p-4" aria-label="Season editor">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block text-xs font-bold text-marble">
                    Start year
                    <input
                      required
                      inputMode="numeric"
                      pattern="\d{4}"
                      value={seasonForm.startYear}
                      onChange={(e) => setSeasonForm({ ...seasonForm, startYear: e.target.value })}
                      className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                    />
                  </label>
                  <label className="block text-xs font-bold text-marble">
                    End year (optional)
                    <input
                      inputMode="numeric"
                      pattern="\d{4}"
                      value={seasonForm.endYear}
                      onChange={(e) => setSeasonForm({ ...seasonForm, endYear: e.target.value })}
                      className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                    />
                  </label>
                  <label className="block text-xs font-bold text-marble">
                    Status
                    <select
                      value={seasonForm.status}
                      onChange={(e) => setSeasonForm({ ...seasonForm, status: e.target.value as SeasonForm["status"] })}
                      className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                    </select>
                  </label>
                </div>
                <label className="block text-xs font-bold text-marble">
                  Challenge name
                  <input
                    required
                    maxLength={160}
                    value={seasonForm.challengeName}
                    onChange={(e) => setSeasonForm({ ...seasonForm, challengeName: e.target.value })}
                    className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  />
                </label>
                <label className="block text-xs font-bold text-marble">
                  Robot name (optional)
                  <input
                    maxLength={120}
                    value={seasonForm.robotName}
                    onChange={(e) => setSeasonForm({ ...seasonForm, robotName: e.target.value })}
                    className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  />
                </label>
                <label className="block text-xs font-bold text-marble">
                  Season summary (optional)
                  <textarea
                    maxLength={2000}
                    rows={3}
                    value={seasonForm.summary}
                    onChange={(e) => setSeasonForm({ ...seasonForm, summary: e.target.value })}
                    className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  />
                </label>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-11 bg-ares-red px-5 py-2 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
                  >
                    {saving ? "Saving…" : seasonForm.id ? "Save season" : "Create season"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeasonForm(null)}
                    className="min-h-11 border border-white/20 px-4 py-2 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {seasons.length === 0 ? (
              <p className="mt-4 text-sm text-marble/60">
                No seasons recorded yet. Add the first season to start the public timeline.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-white/5">
                {seasons.map((season) => (
                  <li key={season.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-bold text-white">
                        {season.startYear}–{season.endYear ?? ""} {season.challengeName}
                        {season.isDeleted === 1 && (
                          <span className="ml-2 border border-ares-red/40 px-2 py-0.5 text-[10px] uppercase text-ares-red">Archived</span>
                        )}
                        {season.status === "draft" && (
                          <span className="ml-2 border border-white/20 px-2 py-0.5 text-[10px] uppercase text-marble/70">Draft</span>
                        )}
                      </p>
                      {season.robotName && <p className="text-xs text-marble/60">Robot: {season.robotName}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSeasonForm({
                            id: season.id,
                            startYear: String(season.startYear),
                            endYear: season.endYear ? String(season.endYear) : "",
                            challengeName: season.challengeName,
                            robotName: season.robotName ?? "",
                            summary: season.summary ?? "",
                            status: season.status,
                          })
                        }
                        className="inline-flex min-h-11 items-center gap-1 border border-white/20 px-3 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                      >
                        <Edit2 size={12} aria-hidden="true" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void setLifecycle("seasons", season.id, season.isDeleted !== 1)}
                        className="inline-flex min-h-11 items-center border border-white/20 px-3 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                      >
                        {season.isDeleted === 1 ? "Restore" : "Archive"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border border-white/10 bg-black/25 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="inline-flex items-center gap-2 font-heading text-xl font-black uppercase text-white">
                <Award size={18} className="text-ares-gold" aria-hidden="true" /> Awards
              </h2>
              <button
                type="button"
                onClick={() => setAwardForm({ ...EMPTY_AWARD })}
                className="inline-flex min-h-11 items-center gap-2 bg-ares-red px-4 py-2 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <Plus size={14} aria-hidden="true" /> New award
              </button>
            </div>

            {awardForm && (
              <form onSubmit={saveAward} className="mt-4 space-y-3 border border-white/10 p-4" aria-label="Award editor">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-marble">
                    Title
                    <input
                      required
                      maxLength={160}
                      value={awardForm.title}
                      onChange={(e) => setAwardForm({ ...awardForm, title: e.target.value })}
                      className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                    />
                  </label>
                  <label className="block text-xs font-bold text-marble">
                    Event
                    <input
                      required
                      maxLength={160}
                      value={awardForm.eventName}
                      onChange={(e) => setAwardForm({ ...awardForm, eventName: e.target.value })}
                      className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                    />
                  </label>
                  <label className="block text-xs font-bold text-marble">
                    Date (YYYY-MM-DD)
                    <input
                      required
                      pattern="\d{4}-\d{2}-\d{2}"
                      value={awardForm.date}
                      onChange={(e) => setAwardForm({ ...awardForm, date: e.target.value })}
                      className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                    />
                  </label>
                  <label className="block text-xs font-bold text-marble">
                    Season (optional)
                    <select
                      value={awardForm.seasonId}
                      onChange={(e) => setAwardForm({ ...awardForm, seasonId: e.target.value })}
                      className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                    >
                      <option value="">No linked season</option>
                      {seasons.filter((s) => s.isDeleted !== 1).map((season) => (
                        <option key={season.id} value={season.id}>
                          {season.startYear} {season.challengeName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block text-xs font-bold text-marble">
                  Description (optional)
                  <textarea
                    maxLength={1000}
                    rows={2}
                    value={awardForm.description}
                    onChange={(e) => setAwardForm({ ...awardForm, description: e.target.value })}
                    className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  />
                </label>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-11 bg-ares-red px-5 py-2 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
                  >
                    {saving ? "Saving…" : awardForm.id ? "Save award" : "Create award"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAwardForm(null)}
                    className="inline-flex min-h-11 items-center gap-1 border border-white/20 px-4 py-2 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  >
                    <X size={12} aria-hidden="true" /> Cancel
                  </button>
                </div>
              </form>
            )}

            {awards.length === 0 ? (
              <p className="mt-4 text-sm text-marble/60">
                No awards recorded yet. Competition honors belong here for judges and sponsors.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-white/5">
                {awards.map((award) => (
                  <li key={award.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-bold text-white">
                        {award.title}
                        {award.isDeleted === 1 && (
                          <span className="ml-2 border border-ares-red/40 px-2 py-0.5 text-[10px] uppercase text-ares-red">Archived</span>
                        )}
                      </p>
                      <p className="text-xs text-marble/60">
                        {award.eventName} · {award.date}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setAwardForm({
                            id: award.id,
                            title: award.title,
                            eventName: award.eventName,
                            date: award.date,
                            description: award.description ?? "",
                            seasonId: award.seasonId ?? "",
                            status: award.status,
                          })
                        }
                        className="inline-flex min-h-11 items-center gap-1 border border-white/20 px-3 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                      >
                        <Edit2 size={12} aria-hidden="true" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void setLifecycle("awards", award.id, award.isDeleted !== 1)}
                        className="inline-flex min-h-11 items-center border border-white/20 px-3 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                      >
                        {award.isDeleted === 1 ? "Restore" : "Archive"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
