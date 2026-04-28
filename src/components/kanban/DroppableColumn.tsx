import React from "react";
import { useDroppable } from "@dnd-kit/core";

interface DroppableColumnProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function DroppableColumn({ id, children, className }: DroppableColumnProps) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  );
}
