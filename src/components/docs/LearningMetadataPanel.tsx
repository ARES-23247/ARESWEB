import { AlertTriangle, Clock, ExternalLink, GitCommit, ShieldCheck } from "lucide-react";
import type { PublicDocument } from "@/lib/publicContentApi";
import {
  LEARNING_CONTENT_TYPES,
  LEARNING_LEVELS,
  LEARNING_PLATFORMS,
  LEARNING_SAFETY_SCOPES,
  LEARNING_SUBJECTS,
  labelFor,
} from "@/lib/learningContent";

export default function LearningMetadataPanel({ document }: { document: PublicDocument }) {
  const requiresHardwareCare = document.safetyScope === "bench-testing" || document.safetyScope === "physical-robot";
  return (
    <aside aria-label="Lesson details" className="mb-8 space-y-4 border border-white/10 bg-white/[0.035] p-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <MetadataItem label="Subject" value={labelFor(LEARNING_SUBJECTS, document.subject)} />
        <MetadataItem label="Format" value={labelFor(LEARNING_CONTENT_TYPES, document.contentType)} />
        <MetadataItem label="Level" value={labelFor(LEARNING_LEVELS, document.level)} />
        <MetadataItem label="Time" value={document.estimatedMinutes ? `${document.estimatedMinutes} minutes` : "Not recorded"} icon={<Clock size={14} aria-hidden="true" />} />
      </dl>

      {(document.platforms.length > 0 || document.appliesToVersion) && (
        <div className="flex flex-wrap gap-2 text-xs text-marble/70">
          {document.platforms.map((platform) => <span key={platform} className="border border-white/15 px-2 py-1">{labelFor(LEARNING_PLATFORMS, platform)}</span>)}
          {document.appliesToVersion && <span className="inline-flex items-center gap-1 border border-ares-gold/30 px-2 py-1 text-ares-gold"><GitCommit size={13} aria-hidden="true" />Applies to {document.appliesToVersion}</span>}
        </div>
      )}

      <div className={`flex gap-3 border p-3 text-xs leading-5 ${requiresHardwareCare ? "border-ares-gold/35 bg-ares-gold/10 text-white" : "border-white/10 bg-black/20 text-marble/70"}`}>
        {requiresHardwareCare ? <AlertTriangle className="mt-0.5 shrink-0 text-ares-gold" size={17} aria-hidden="true" /> : <ShieldCheck className="mt-0.5 shrink-0 text-ares-gold" size={17} aria-hidden="true" />}
        <div><strong className="block text-white">{labelFor(LEARNING_SAFETY_SCOPES, document.safetyScope)}</strong>{safetyDescription(document.safetyScope)}</div>
      </div>

      {document.sourceReferences.length > 0 && (
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-marble/65">Verified sources</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {document.sourceReferences.map((source) => (
              <li key={`${source.url}-${source.label}`}>
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-start gap-2 text-ares-cyan underline decoration-ares-cyan/40 underline-offset-4 focus-visible:ring-2 focus-visible:ring-ares-cyan">
                  <ExternalLink className="mt-0.5 shrink-0" size={14} aria-hidden="true" />
                  <span className="min-w-0 break-words">{source.label}{source.revision ? ` — ${source.revision}` : ""}{source.blobHash ? ` (${source.blobHash.slice(0, 12)})` : ""}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {document.metadataStatus === "legacy-inferred" && (
        <p className="border-t border-white/10 pt-3 text-xs leading-5 text-marble/60">
          This older item has an inferred subject and level. Version, review, and source provenance may not have been recorded yet.
        </p>
      )}
      {document.metadataStatus === "complete" && document.reviewedAt && (
        <p className="border-t border-white/10 pt-3 text-xs text-marble/60">Reviewed {document.reviewedAt}{document.reviewedByLabel ? ` by ${document.reviewedByLabel}` : ""}.</p>
      )}
    </aside>
  );
}

function MetadataItem({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return <div><dt className="text-[10px] font-bold uppercase tracking-wider text-marble/55">{label}</dt><dd className="mt-1 flex items-center gap-1.5 font-medium text-white">{icon}{value}</dd></div>;
}

function safetyDescription(scope: PublicDocument["safetyScope"]): string {
  switch (scope) {
    case "simulation-only": return " Complete the activity in the simulator; it does not validate physical hardware behavior.";
    case "bench-testing": return " Use adult supervision, secure the robot, remove pinch hazards, and be ready to disconnect power.";
    case "physical-robot": return " Follow team hardware procedures, use a clear test area, and keep an emergency stop available.";
    default: return " This item does not require operating physical robot hardware.";
  }
}
