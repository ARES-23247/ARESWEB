import React from "react";
import TiptapRenderer, { ASTNode } from "@/components/TiptapRenderer";
import { EventItem } from "./types";
import { toTiptapAst, toPlainText } from "@/lib/contentFormatters";
import DocsMarkdownRenderer from "@/components/docs/DocsMarkdownRenderer";

interface EventDescriptionProps {
  event: EventItem;
  parsedAst: ASTNode | null;
}

export default function EventDescription({ event, parsedAst }: EventDescriptionProps) {
  const ast = parsedAst || toTiptapAst(event.description);
  const plainText = toPlainText(event.description);

  if (ast) {
    return (
      <div className="prose prose-invert max-w-none">
        <TiptapRenderer node={ast} />
      </div>
    );
  }

  if (!plainText) {
    return (
      <div className="prose prose-invert max-w-none">
        <p className="italic text-marble/50 text-sm">No detailed description provided for this event.</p>
      </div>
    );
  }

  return (
    <div className="prose prose-invert max-w-none">
      <DocsMarkdownRenderer content={plainText} />
    </div>
  );
}
