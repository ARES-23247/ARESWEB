import React from "react";
import { cn } from "@/lib/utils";

interface GreekMeanderProps {
  /**
   * 'thin' uses the smaller meander pattern (8px) used for headers/borders.
   * 'thick' uses the larger pattern (12px) used for section dividers.
   */
  variant?: "thin" | "thick";
  /**
   * Tailwind opacity class (e.g., 'opacity-50', 'opacity-20').
   */
  opacity?: string;
  /**
   * Optional additional classes.
   */
  className?: string;
}

/**
 * ARES 23247 Standard Greek Meander branding element.
 */
export const GreekMeander: React.FC<GreekMeanderProps> = ({
  variant = "thin",
  opacity = "opacity-80",
  className,
}) => {
  return (
    <div
      className={cn(
        "w-full bg-repeat-x pointer-events-none",
        variant === "thin" ? "h-2 meander-border" : "h-3 meander-divider",
        opacity,
        className
      )}
      aria-hidden="true"
    />
  );
};

export default GreekMeander;
