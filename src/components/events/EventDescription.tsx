import React from "react";
import TiptapRenderer, { ASTNode } from "@/components/TiptapRenderer";
import { EventItem } from "./types";

interface EventDescriptionProps {
  event: EventItem;
  parsedAst: ASTNode | null;
}

export default function EventDescription({ event, parsedAst }: EventDescriptionProps) {
  return (
    <div className="prose prose-invert max-w-none">
      {parsedAst ? (
        <TiptapRenderer node={parsedAst} />
      ) : (
        <p className="whitespace-pre-wrap text-base md:text-lg leading-relaxed text-marble/90">
          {event.description}
        </p>
      )}
    </div>
  );
}
