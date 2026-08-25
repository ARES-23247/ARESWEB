import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  LEARNING_CONTENT_TYPES,
  LEARNING_LEVELS,
  LEARNING_PATHS,
  LEARNING_PLATFORMS,
  LEARNING_SAFETY_SCOPES,
  LEARNING_SUBJECTS,
} from "@/lib/learningContent";
import type { DocumentEditorDraft } from "./documentEditorDraft";

interface LearningMetadataFieldsProps {
  draft: DocumentEditorDraft;
  onChange: <Key extends keyof DocumentEditorDraft>(field: Key, value: DocumentEditorDraft[Key]) => void;
}

function lines(value: string): string[] {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

export default function LearningMetadataFields({ draft, onChange }: LearningMetadataFieldsProps) {
  return (
    <fieldset className="space-y-6 border border-white/10 bg-black/20 p-4">
      <legend className="px-2 font-heading text-sm font-bold uppercase tracking-wider text-ares-gold">Learning metadata</legend>
      <p className="text-xs leading-5 text-marble/65">This information powers Academy subjects, guided paths, prerequisites, version labels, and safety notices.</p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SelectField id="learning-subject" label="Subject" value={draft.subject} options={LEARNING_SUBJECTS} onChange={(value) => onChange("subject", value as DocumentEditorDraft["subject"])} />
        <SelectField id="learning-type" label="Content type" value={draft.contentType} options={LEARNING_CONTENT_TYPES} onChange={(value) => onChange("contentType", value as DocumentEditorDraft["contentType"])} />
        <SelectField id="learning-level" label="Level" value={draft.level} options={LEARNING_LEVELS} onChange={(value) => onChange("level", value as DocumentEditorDraft["level"])} />
        <label htmlFor="learning-duration">
          <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-marble/60">Estimated minutes</span>
          <input id="learning-duration" type="number" min={1} max={600} value={draft.estimatedMinutes} onChange={(event) => onChange("estimatedMinutes", Number(event.target.value))} className="w-full rounded border border-white/10 bg-black/60 px-3 py-2.5 text-xs text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" required />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextListField id="learning-topics" label="Topics (one per line)" value={draft.topics} onChange={(value) => onChange("topics", value)} />
        <TextListField id="learning-prerequisites" label="Prerequisite lesson slugs (one per line)" value={draft.prerequisites} onChange={(value) => onChange("prerequisites", value)} />
        <TextListField id="learning-objectives" label="Learning objectives (one per line)" value={draft.objectives} onChange={(value) => onChange("objectives", value)} rows={5} />
        <div>
          <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-marble/60">Platforms</span>
          <div className="grid grid-cols-2 gap-2 border border-white/5 bg-black/25 p-3">
            {LEARNING_PLATFORMS.map((platform) => (
              <label key={platform.id} className="flex min-h-11 items-center gap-2 text-xs text-marble/90">
                <input type="checkbox" checked={draft.platforms.includes(platform.id)} onChange={(event) => onChange("platforms", event.target.checked ? [...draft.platforms, platform.id] : draft.platforms.filter((value) => value !== platform.id))} className="h-4 w-4 accent-ares-red focus-visible:ring-2 focus-visible:ring-ares-cyan" />
                {platform.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div>
        <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-marble/60">Learning paths and order</span>
        <div className="grid gap-2 md:grid-cols-2">
          {LEARNING_PATHS.map((path) => {
            const membership = draft.pathMemberships.find((item) => item.pathId === path.id);
            return (
              <div key={path.id} className="flex min-h-12 items-center gap-3 border border-white/5 bg-black/25 p-3">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-marble/90">
                  <input type="checkbox" checked={Boolean(membership)} onChange={(event) => onChange("pathMemberships", event.target.checked ? [...draft.pathMemberships, { pathId: path.id, order: 0 }] : draft.pathMemberships.filter((item) => item.pathId !== path.id))} className="h-4 w-4 shrink-0 accent-ares-red focus-visible:ring-2 focus-visible:ring-ares-cyan" />
                  <span>{path.label}</span>
                </label>
                {membership && (
                  <label className="flex items-center gap-2 text-[10px] uppercase text-marble/60">
                    Order
                    <input aria-label={`${path.label} order`} type="number" min={0} max={10000} value={membership.order} onChange={(event) => onChange("pathMemberships", draft.pathMemberships.map((item) => item.pathId === path.id ? { ...item, order: Number(event.target.value) } : item))} className="w-20 rounded border border-white/10 bg-black/60 px-2 py-1.5 text-xs text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label htmlFor="learning-version">
          <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-marble/60">Applies to version</span>
          <input id="learning-version" value={draft.appliesToVersion} onChange={(event) => onChange("appliesToVersion", event.target.value)} placeholder="e.g. ARES 9.3.6" className="w-full rounded border border-white/10 bg-black/60 px-3 py-2.5 text-xs text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" />
        </label>
        <label htmlFor="learning-reviewed-at">
          <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-marble/60">Reviewed date</span>
          <input id="learning-reviewed-at" type="date" value={draft.reviewedAt} onChange={(event) => onChange("reviewedAt", event.target.value)} className="w-full rounded border border-white/10 bg-black/60 px-3 py-2.5 text-xs text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" />
        </label>
        <label htmlFor="learning-reviewed-by">
          <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-marble/60">Public reviewer label</span>
          <input id="learning-reviewed-by" value={draft.reviewedByLabel} onChange={(event) => onChange("reviewedByLabel", event.target.value)} placeholder="e.g. ARES software mentor" className="w-full rounded border border-white/10 bg-black/60 px-3 py-2.5 text-xs text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" />
        </label>
        <SelectField id="learning-safety" label="Safety scope" value={draft.safetyScope} options={LEARNING_SAFETY_SCOPES} onChange={(value) => onChange("safetyScope", value as DocumentEditorDraft["safetyScope"])} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-marble/60">Verified source references</span>
          <button type="button" onClick={() => onChange("sourceReferences", [...draft.sourceReferences, { label: "", url: "" }])} className="inline-flex min-h-11 items-center gap-2 border border-white/15 px-3 text-[10px] font-bold uppercase text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><Plus size={13} aria-hidden="true" />Add source</button>
        </div>
        {draft.sourceReferences.length === 0 ? <p className="border border-dashed border-white/10 p-4 text-xs text-marble/55">No source reference has been recorded yet.</p> : (
          <div className="space-y-3">
            {draft.sourceReferences.map((source, index) => (
              <div key={index} className="grid gap-3 border border-white/5 bg-black/25 p-3 md:grid-cols-2 xl:grid-cols-[1fr_2fr_1fr_1fr_auto]">
                <label><span className="mb-1 block text-[10px] uppercase text-marble/60">Label</span><input value={source.label} onChange={(event) => onChange("sourceReferences", draft.sourceReferences.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} className="w-full rounded border border-white/10 bg-black/60 px-3 py-2 text-xs text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" required /></label>
                <label><span className="mb-1 block text-[10px] uppercase text-marble/60">HTTPS source URL</span><input type="url" pattern="https://.*" value={source.url} onChange={(event) => onChange("sourceReferences", draft.sourceReferences.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))} className="w-full rounded border border-white/10 bg-black/60 px-3 py-2 text-xs text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" required /></label>
                <label><span className="mb-1 block text-[10px] uppercase text-marble/60">Revision/tag</span><input value={source.revision || ""} onChange={(event) => onChange("sourceReferences", draft.sourceReferences.map((item, itemIndex) => itemIndex === index ? { ...item, revision: event.target.value } : item))} className="w-full rounded border border-white/10 bg-black/60 px-3 py-2 text-xs text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" /></label>
                <label><span className="mb-1 block text-[10px] uppercase text-marble/60">Git blob hash</span><input pattern="[a-fA-F0-9]{7,64}" value={source.blobHash || ""} onChange={(event) => onChange("sourceReferences", draft.sourceReferences.map((item, itemIndex) => itemIndex === index ? { ...item, blobHash: event.target.value } : item))} className="w-full rounded border border-white/10 bg-black/60 px-3 py-2 font-mono text-xs text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" /></label>
                <button type="button" aria-label={`Remove source ${index + 1}`} onClick={() => onChange("sourceReferences", draft.sourceReferences.filter((_, itemIndex) => itemIndex !== index))} className="min-h-11 self-end border border-ares-red/30 px-3 text-ares-red focus-visible:ring-2 focus-visible:ring-ares-cyan"><Trash2 size={16} aria-hidden="true" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </fieldset>
  );
}

function SelectField<T extends string>({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: readonly { id: T; label: string }[]; onChange: (value: string) => void }) {
  return <label htmlFor={id}><span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-marble/60">{label}</span><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded border border-white/10 bg-black/60 px-3 py-2.5 text-xs text-white focus-visible:ring-2 focus-visible:ring-ares-cyan">{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>;
}

function TextListField({ id, label, value, onChange, rows = 3 }: { id: string; label: string; value: string[]; onChange: (value: string[]) => void; rows?: number }) {
  const serialized = value.join("\n");
  const [text, setText] = useState(serialized);
  const lastEmitted = useRef(serialized);
  useEffect(() => {
    if (serialized !== lastEmitted.current) {
      setText(serialized);
      lastEmitted.current = serialized;
    }
  }, [serialized]);
  return <label htmlFor={id}><span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-marble/60">{label}</span><textarea id={id} rows={rows} value={text} onChange={(event) => { const next = event.target.value; setText(next); const parsed = lines(next); lastEmitted.current = parsed.join("\n"); onChange(parsed); }} className="w-full resize-y rounded border border-white/10 bg-black/60 p-3 text-xs leading-5 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan" /></label>;
}
