import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import type { RobotItem, RobotVersion } from "./types";

interface RobotEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingRobot: RobotItem | null;
  onSubmit: (id: string, data: Omit<RobotItem, "id" | "isDeleted">) => void;
  isPending: boolean;
  submissionError?: string | null;
}

const emptyRobot: Omit<RobotItem, "id" | "isDeleted"> = {
  name: "",
  seasonName: "",
  challengeName: "",
  weightLbs: undefined,
  drivetrainType: "",
  programmingLanguage: "",
  revealVideoId: "",
  onshapeUrl: "",
  cadViewerUrl: "",
  primaryMechanism: "",
  content: "",
  versions: [],
};

export default function RobotEditorModal({
  isOpen,
  onClose,
  editingRobot,
  onSubmit,
  isPending,
  submissionError,
}: RobotEditorModalProps) {
  const [formId, setFormId] = useState("");
  const [draft, setDraft] = useState(emptyRobot);

  useEffect(() => {
    if (!isOpen) return;
    setFormId(editingRobot?.id ?? "");
    setDraft(editingRobot ? {
      name: editingRobot.name,
      seasonName: editingRobot.seasonName,
      challengeName: editingRobot.challengeName,
      weightLbs: editingRobot.weightLbs,
      drivetrainType: editingRobot.drivetrainType ?? "",
      programmingLanguage: editingRobot.programmingLanguage ?? "",
      revealVideoId: editingRobot.revealVideoId ?? "",
      onshapeUrl: editingRobot.onshapeUrl ?? "",
      cadViewerUrl: editingRobot.cadViewerUrl ?? "",
      primaryMechanism: editingRobot.primaryMechanism ?? "",
      content: editingRobot.content ?? "",
      versions: editingRobot.versions?.map((version) => ({ ...version })) ?? [],
    } : { ...emptyRobot, versions: [] });
  }, [editingRobot, isOpen]);

  const setField = <K extends keyof typeof draft>(field: K, value: (typeof draft)[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateVersion = <K extends keyof RobotVersion>(index: number, field: K, value: RobotVersion[K]) => {
    setDraft((current) => ({
      ...current,
      versions: (current.versions ?? []).map((version, versionIndex) => (
        versionIndex === index ? { ...version, [field]: value } : version
      )),
    }));
  };

  const addVersion = () => {
    setDraft((current) => ({
      ...current,
      versions: [...(current.versions ?? []), { name: `V${(current.versions?.length ?? 0) + 1}`, content: "" }],
    }));
  };

  const removeVersion = (index: number) => {
    setDraft((current) => ({
      ...current,
      versions: (current.versions ?? []).filter((_, versionIndex) => versionIndex !== index),
    }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(formId, draft);
  };

  const inputClass = "w-full bg-black/40 border border-white/10 ares-cut-sm px-4 py-2.5 text-white placeholder-white/30 focus:border-ares-cyan focus:outline-none focus:ring-2 focus:ring-ares-cyan text-sm";
  const labelClass = "block text-xs font-black uppercase tracking-wider text-marble/75 mb-1.5";

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open && !isPending) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto bg-obsidian border border-white/10 ares-cut-lg p-6 md:p-8 shadow-2xl focus:outline-none"
          aria-describedby="robot-editor-description"
        >
          <Dialog.Close asChild>
            <button
              type="button"
              disabled={isPending}
              className="absolute top-4 right-4 text-marble/70 hover:text-white p-2 hover:bg-white/5 ares-cut-sm focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
              aria-label="Close robot editor"
            >
              <X aria-hidden="true" size={20} />
            </button>
          </Dialog.Close>

          <Dialog.Title className="pr-12 text-2xl font-black uppercase text-white font-heading">
            {editingRobot ? "Edit Fleet Record" : "Deploy New Robot"}
          </Dialog.Title>
          <Dialog.Description id="robot-editor-description" className="text-sm text-marble/70 mt-2">
            Add the published engineering details for this robot. CAD links must use <span className="font-mono">https://cad.onshape.com</span>.
          </Dialog.Description>

          {submissionError && (
            <div role="alert" className="mt-5 border border-ares-red bg-ares-red/10 p-4 text-sm text-white ares-cut-sm">
              <p className="font-bold">The fleet record was not saved. Your draft is still here.</p>
              <p className="mt-1 font-mono text-xs text-marble/80">{submissionError}</p>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Robot name" id="robot-name" className={labelClass}>
                <input id="robot-name" value={draft.name} onChange={(e) => setField("name", e.target.value)} className={inputClass} required maxLength={120} />
              </Field>
              <Field label="Robot ID / slug" id="robot-id" className={labelClass}>
                <input id="robot-id" value={formId} onChange={(e) => setFormId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} className={inputClass} disabled={Boolean(editingRobot)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} />
              </Field>
              <Field label="Season name" id="robot-season" className={labelClass}>
                <input id="robot-season" value={draft.seasonName} onChange={(e) => setField("seasonName", e.target.value)} className={inputClass} required maxLength={80} />
              </Field>
              <Field label="Challenge name" id="robot-challenge" className={labelClass}>
                <input id="robot-challenge" value={draft.challengeName} onChange={(e) => setField("challengeName", e.target.value)} className={inputClass} required maxLength={120} />
              </Field>
              <Field label="Weight (lbs)" id="robot-weight" className={labelClass}>
                <input id="robot-weight" type="number" min="0.1" max="100" step="0.1" value={draft.weightLbs ?? ""} onChange={(e) => setField("weightLbs", e.target.value ? Number(e.target.value) : undefined)} className={inputClass} />
              </Field>
              <Field label="Drivetrain" id="robot-drivetrain" className={labelClass}>
                <input id="robot-drivetrain" value={draft.drivetrainType ?? ""} onChange={(e) => setField("drivetrainType", e.target.value)} className={inputClass} required maxLength={160} />
              </Field>
              <Field label="Programming language" id="robot-language" className={labelClass}>
                <input id="robot-language" value={draft.programmingLanguage ?? ""} onChange={(e) => setField("programmingLanguage", e.target.value)} className={inputClass} maxLength={120} />
              </Field>
              <Field label="Primary mechanism" id="robot-mechanism" className={labelClass}>
                <input id="robot-mechanism" value={draft.primaryMechanism ?? ""} onChange={(e) => setField("primaryMechanism", e.target.value)} className={inputClass} maxLength={240} />
              </Field>
              <Field label="YouTube video ID" id="robot-video" className={labelClass}>
                <input id="robot-video" value={draft.revealVideoId ?? ""} onChange={(e) => setField("revealVideoId", e.target.value)} className={inputClass} pattern="[A-Za-z0-9_-]{11}" aria-describedby="robot-video-help" />
                <p id="robot-video-help" className="mt-1 text-xs text-marble/55">Use the 11-character ID, not the full URL.</p>
              </Field>
              <Field label="Onshape workspace URL" id="robot-onshape" className={labelClass}>
                <input id="robot-onshape" type="url" value={draft.onshapeUrl ?? ""} onChange={(e) => setField("onshapeUrl", e.target.value)} className={inputClass} placeholder="https://cad.onshape.com/documents/..." />
              </Field>
              <Field label="Onshape CAD embed URL" id="robot-cad-viewer" className={labelClass}>
                <input id="robot-cad-viewer" type="url" value={draft.cadViewerUrl ?? ""} onChange={(e) => setField("cadViewerUrl", e.target.value)} className={inputClass} placeholder="https://cad.onshape.com/documents/..." />
              </Field>
            </div>

            <Field label="System description" id="robot-content" className={labelClass}>
              <textarea id="robot-content" rows={5} value={draft.content ?? ""} onChange={(e) => setField("content", e.target.value)} className={`${inputClass} resize-y`} maxLength={20_000} />
            </Field>

            <fieldset className="border-t border-white/10 pt-6 space-y-4">
              <legend className="text-sm font-black uppercase tracking-wider text-white">Build versions</legend>
              <button type="button" onClick={addVersion} className="inline-flex items-center gap-2 px-3 py-2 bg-ares-red text-white text-xs font-black uppercase ares-cut-sm focus-visible:ring-2 focus-visible:ring-ares-cyan">
                <Plus aria-hidden="true" size={14} /> Add version
              </button>
              {(draft.versions ?? []).map((version, index) => {
                const prefix = `robot-version-${index}`;
                return (
                  <fieldset key={prefix} className="relative bg-white/5 border border-white/10 p-4 ares-cut-sm space-y-3">
                    <legend className="px-2 text-xs font-bold text-marble/75">Version {index + 1}</legend>
                    <button type="button" onClick={() => removeVersion(index)} className="absolute top-2 right-2 p-2 text-marble/70 hover:text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" aria-label={`Remove version ${index + 1}`}>
                      <X aria-hidden="true" size={16} />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-8">
                      <Field label="Version name" id={`${prefix}-name`} className={labelClass}><input id={`${prefix}-name`} value={version.name} onChange={(e) => updateVersion(index, "name", e.target.value)} className={inputClass} required maxLength={120} /></Field>
                      <Field label="Weight (lbs)" id={`${prefix}-weight`} className={labelClass}><input id={`${prefix}-weight`} type="number" min="0.1" max="100" step="0.1" value={version.weightLbs ?? ""} onChange={(e) => updateVersion(index, "weightLbs", e.target.value ? Number(e.target.value) : undefined)} className={inputClass} /></Field>
                      <Field label="Drivetrain" id={`${prefix}-drivetrain`} className={labelClass}><input id={`${prefix}-drivetrain`} value={version.drivetrainType ?? ""} onChange={(e) => updateVersion(index, "drivetrainType", e.target.value)} className={inputClass} maxLength={160} /></Field>
                      <Field label="Primary mechanism" id={`${prefix}-mechanism`} className={labelClass}><input id={`${prefix}-mechanism`} value={version.primaryMechanism ?? ""} onChange={(e) => updateVersion(index, "primaryMechanism", e.target.value)} className={inputClass} maxLength={240} /></Field>
                      <Field label="Onshape CAD embed URL" id={`${prefix}-cad`} className={labelClass}><input id={`${prefix}-cad`} type="url" value={version.cadViewerUrl ?? ""} onChange={(e) => updateVersion(index, "cadViewerUrl", e.target.value)} className={inputClass} /></Field>
                    </div>
                    <Field label="Version description" id={`${prefix}-content`} className={labelClass}><textarea id={`${prefix}-content`} rows={3} value={version.content} onChange={(e) => updateVersion(index, "content", e.target.value)} className={`${inputClass} resize-y`} maxLength={20_000} /></Field>
                  </fieldset>
                );
              })}
            </fieldset>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Dialog.Close asChild><button type="button" disabled={isPending} className="px-5 py-2.5 border border-white/20 text-xs font-black uppercase text-white ares-cut-sm focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50">Cancel</button></Dialog.Close>
              <button type="submit" disabled={isPending} className="px-5 py-2.5 bg-ares-red text-white text-xs font-black uppercase ares-cut-sm focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50">
                {isPending ? "Saving…" : editingRobot ? "Save changes" : "Deploy robot"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ label, id, className, children }: { label: string; id: string; className: string; children: ReactNode }) {
  return <div><label htmlFor={id} className={className}>{label}</label>{children}</div>;
}
