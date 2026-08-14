"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Code, Compass, Cpu, Edit2, Plus, RotateCcw, Scale, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { PublicDataState } from "@/components/PublicDataState";
import { useAuth } from "@/context/AuthContext";
import {
  canManageRobots,
  createRobot,
  decommissionRobot,
  fetchRobots,
  restoreRobot,
  updateRobot,
} from "./api";
import RobotEditorModal from "./RobotEditorModal";
import type { RobotItem } from "./types";

export default function RobotsFeedPage() {
  const queryClient = useQueryClient();
  const { authorizedUser } = useAuth();
  const canEdit = canManageRobots(authorizedUser?.role);
  const [isOpen, setIsOpen] = useState(false);
  const [editingRobot, setEditingRobot] = useState<RobotItem | null>(null);
  const [confirmRobot, setConfirmRobot] = useState<RobotItem | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const { data: robots = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["robots", { includeArchived: canEdit }],
    queryFn: () => fetchRobots(canEdit),
  });

  const refreshFleet = async () => {
    await queryClient.invalidateQueries({ queryKey: ["robots"] });
  };

  const createMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<RobotItem, "id" | "isDeleted"> }) => createRobot(id, data),
    onSuccess: async () => {
      await refreshFleet();
      setIsOpen(false);
      toast.success("Robot deployed to the fleet archive.");
    },
    onError: (mutationError) => {
      setSubmissionError(mutationError instanceof Error ? mutationError.message : String(mutationError));
      toast.error("The robot was not saved. Your draft is still open.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<RobotItem, "id" | "isDeleted"> }) => updateRobot(id, data),
    onSuccess: async (_, variables) => {
      await refreshFleet();
      await queryClient.invalidateQueries({ queryKey: ["robots", variables.id] });
      setIsOpen(false);
      toast.success("Robot fleet record updated.");
    },
    onError: (mutationError) => {
      setSubmissionError(mutationError instanceof Error ? mutationError.message : String(mutationError));
      toast.error("The robot was not updated. Your draft is still open.");
    },
  });

  const decommissionMutation = useMutation({
    mutationFn: decommissionRobot,
    onSuccess: async () => {
      await refreshFleet();
      setConfirmRobot(null);
      toast.success("Robot decommissioned. It can be restored here later.");
    },
    onError: (mutationError) => toast.error(mutationError instanceof Error ? mutationError.message : String(mutationError)),
  });

  const restoreMutation = useMutation({
    mutationFn: restoreRobot,
    onSuccess: async () => {
      await refreshFleet();
      toast.success("Robot restored to the public fleet.");
    },
    onError: (mutationError) => toast.error(mutationError instanceof Error ? mutationError.message : String(mutationError)),
  });

  const openEditor = (robot: RobotItem | null) => {
    setEditingRobot(robot);
    setSubmissionError(null);
    createMutation.reset();
    updateMutation.reset();
    setIsOpen(true);
  };

  const submitEditor = (id: string, data: Omit<RobotItem, "id" | "isDeleted">) => {
    setSubmissionError(null);
    if (editingRobot) updateMutation.mutate({ id: editingRobot.id, data });
    else createMutation.mutate({ id, data });
  };

  return (
    <main className="w-full min-h-screen bg-obsidian text-marble py-8">
      <SEO title="Our Robots" description="Explore the competition robots engineered by ARES 23247 for the FIRST® Tech Challenge." />
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-20">
        <header className="text-center mb-16">
          <div className="inline-block bg-ares-red text-white px-4 py-1.5 ares-cut-sm font-black uppercase tracking-widest text-xs mb-6 border border-ares-bronze">
            ARES 23247 Engineering
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 uppercase font-heading text-white">
            The Fleet
          </h1>
          <p className="text-lg text-marble/75 max-w-2xl mx-auto font-medium leading-relaxed mb-8">
            An archive of robotics systems engineered for the <i>FIRST</i>® Tech Challenge by team ARES.
          </p>
          {canEdit && (
            <button onClick={() => openEditor(null)} className="clipped-button bg-ares-red text-white hover:bg-ares-bronze font-black text-xs uppercase tracking-widest py-3 px-6 inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:outline-none">
              <Plus aria-hidden="true" size={16} /> Deploy new robot
            </button>
          )}
        </header>

        {isLoading ? (
          <div className="flex justify-center items-center py-20" role="status" aria-label="Loading robot fleet">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-ares-gold" aria-hidden="true" />
          </div>
        ) : isError ? (
          <PublicDataState title="Unable to load the robot fleet" message="The engineering archive could not be reached. Check your connection and try again." diagnostic={error instanceof Error ? error.message : String(error)} onRetry={() => void refetch()} />
        ) : robots.length === 0 ? (
          <div className="text-center text-marble/70 p-20 glass-card ares-cut border border-white/10">
            <Cpu aria-hidden="true" size={48} className="mx-auto mb-6 opacity-40" />
            <h2 className="text-xl font-bold uppercase tracking-widest text-white">No fleet records</h2>
            <p className="text-sm mt-2">The engineering archive is currently empty.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {robots.map((robot) => {
              const archived = robot.isDeleted === 1;
              return (
                <article key={robot.id} className={`glass-card hero-card overflow-hidden shadow-2xl flex flex-col h-full border ${archived ? "border-ares-bronze opacity-80" : "border-white/10"}`}>
                  <Link to={archived ? "/robots" : `/robots/${robot.id}`} aria-disabled={archived} onClick={(event) => { if (archived) event.preventDefault(); }} className="group flex flex-col flex-1 focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:outline-none">
                    <div className="aspect-video bg-black/40 relative overflow-hidden">
                      {robot.revealVideoId ? <img src={`https://img.youtube.com/vi/${robot.revealVideoId}/hqdefault.jpg`} alt={`${robot.name} reveal video thumbnail`} loading="lazy" className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-opacity" /> : <div className="absolute inset-0 flex items-center justify-center"><Cpu aria-hidden="true" size={64} className="text-white/20" /></div>}
                    </div>
                    <div className="p-8 flex-grow flex flex-col gap-6">
                      <div>
                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className="bg-ares-red text-white text-xs font-black uppercase tracking-wider py-1.5 px-3 ares-cut-sm">{robot.seasonName} · {robot.challengeName}</span>
                          {archived && <span className="bg-ares-bronze text-black text-xs font-black uppercase py-1.5 px-3 ares-cut-sm">Decommissioned</span>}
                        </div>
                        <h2 className="text-3xl font-black text-white group-hover:text-ares-gold transition-colors tracking-tight uppercase font-heading">{robot.name}</h2>
                      </div>
                      <div className="space-y-3 pt-4 border-t border-white/10 mt-auto">
                        <div className="grid grid-cols-2 gap-3">
                          {robot.weightLbs && <Spec icon={<Scale aria-hidden="true" size={14} />} text={`${robot.weightLbs} lbs`} />}
                          {robot.programmingLanguage && <Spec icon={<Code aria-hidden="true" size={14} />} text={robot.programmingLanguage} />}
                        </div>
                        {robot.drivetrainType && <Spec icon={<Cpu aria-hidden="true" size={14} />} text={robot.drivetrainType} />}
                      </div>
                    </div>
                  </Link>

                  {canEdit && (
                    <div className="border-t border-white/10 p-4">
                      {archived ? (
                        <button type="button" onClick={() => restoreMutation.mutate(robot.id)} disabled={restoreMutation.isPending} className="w-full inline-flex justify-center items-center gap-2 bg-ares-red text-white px-4 py-2 text-xs font-black uppercase ares-cut-sm focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50">
                          <RotateCcw aria-hidden="true" size={14} /> Restore robot
                        </button>
                      ) : confirmRobot?.id === robot.id ? (
                        <div role="alert" className="space-y-3">
                          <p className="text-sm text-white">Decommission <strong>{robot.name}</strong>? It will leave the public fleet but remain restorable.</p>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => decommissionMutation.mutate(robot.id)} disabled={decommissionMutation.isPending} className="bg-ares-red text-white px-3 py-2 text-xs font-bold ares-cut-sm focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50">Confirm</button>
                            <button type="button" onClick={() => setConfirmRobot(null)} className="border border-white/20 text-white px-3 py-2 text-xs font-bold ares-cut-sm focus-visible:ring-2 focus-visible:ring-ares-cyan">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => openEditor(robot)} className="flex-1 inline-flex justify-center items-center gap-2 border border-white/20 text-white px-3 py-2 text-xs font-bold ares-cut-sm focus-visible:ring-2 focus-visible:ring-ares-cyan"><Edit2 aria-hidden="true" size={14} /> Edit</button>
                          <button type="button" onClick={() => setConfirmRobot(robot)} className="flex-1 inline-flex justify-center items-center gap-2 bg-ares-red text-white px-3 py-2 text-xs font-bold ares-cut-sm focus-visible:ring-2 focus-visible:ring-ares-cyan"><Trash2 aria-hidden="true" size={14} /> Decommission</button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <RobotEditorModal isOpen={isOpen} onClose={() => setIsOpen(false)} editingRobot={editingRobot} onSubmit={submitEditor} isPending={createMutation.isPending || updateMutation.isPending} submissionError={submissionError} />
    </main>
  );
}

function Spec({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="flex items-center gap-2 bg-white/5 p-2.5 ares-cut-sm border border-white/10 text-ares-gold"><span>{icon}</span><span className="text-xs font-bold text-marble truncate">{text}</span></div>;
}
