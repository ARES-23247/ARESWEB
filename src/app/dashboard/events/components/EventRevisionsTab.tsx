import React from "react";
import RevisionHistoryTable from "@/components/RevisionHistoryTable";
import { EventRevision } from "./EventEditorDrawer";

interface EventRevisionsTabProps {
  revisions: EventRevision[];
  loadingRevisions: boolean;
  handleRevertToRevision: (rev: EventRevision) => void;
}

export default function EventRevisionsTab({
  revisions,
  loadingRevisions,
  handleRevertToRevision
}: EventRevisionsTabProps) {
  return (
    <div className="flex-grow overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-white/5 text-left">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-marble/60">
        Revision Audit History ({revisions.length})
      </h4>
      <RevisionHistoryTable
        revisions={revisions}
        isLoading={loadingRevisions}
        onRevert={handleRevertToRevision}
      />
    </div>
  );
}
