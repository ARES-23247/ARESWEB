import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TableFrameProps extends ComponentPropsWithoutRef<"table"> {
  caption: ReactNode;
  containerClassName?: string;
  captionClassName?: string;
}

export function TableFrame({
  caption,
  containerClassName,
  captionClassName,
  className,
  children,
  ...props
}: TableFrameProps) {
  return (
    <div className={cn("overflow-x-auto", containerClassName)}>
      <table
        {...props}
        className={cn("w-full border-collapse text-left text-xs", className)}
      >
        <caption className={cn("sr-only", captionClassName)}>{caption}</caption>
        {children}
      </table>
    </div>
  );
}
