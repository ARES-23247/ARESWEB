import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type InputHTMLAttributes,
  type AriaAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

interface FieldContextValue {
  controlId: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

function mergeIds(...ids: Array<string | undefined>) {
  const merged = ids.filter(Boolean).join(" ");
  return merged || undefined;
}

export interface FieldProps {
  id?: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({
  id,
  label,
  description,
  error,
  required = false,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? `field-${generatedId}`;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  return (
    <FieldContext.Provider
      value={{
        controlId,
        describedBy: mergeIds(descriptionId, errorId),
        invalid: Boolean(error),
        required,
      }}
    >
      <div className={cn("space-y-1.5", className)}>
        <label htmlFor={controlId} className="block text-xs font-bold text-marble">
          {label}
          {required && (
            <span aria-hidden="true" className="ml-1 text-ares-gold">
              *
            </span>
          )}
        </label>
        {children}
        {description && (
          <p id={descriptionId} className="text-xs leading-relaxed text-marble/65">
            {description}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-xs font-semibold text-white">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

const controlClasses =
  "min-h-11 w-full rounded border border-white/15 bg-obsidian px-3 py-2 text-sm text-white placeholder:text-marble/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-ares-red";

function useFieldControl({
  id,
  describedBy,
  invalid,
  required,
}: {
  id?: string;
  describedBy?: string;
  invalid?: AriaAttributes["aria-invalid"];
  required?: boolean;
}) {
  const field = useContext(FieldContext);
  return {
    id: id ?? field?.controlId,
    "aria-describedby": mergeIds(describedBy, field?.describedBy),
    "aria-invalid": invalid ?? (field?.invalid || undefined),
    required: required ?? field?.required,
  };
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input(
    { id, "aria-describedby": describedBy, "aria-invalid": invalid, required, className, ...props },
    ref,
  ) {
    const fieldProps = useFieldControl({ id, describedBy, invalid, required });
    return <input ref={ref} className={cn(controlClasses, className)} {...fieldProps} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select(
    { id, "aria-describedby": describedBy, "aria-invalid": invalid, required, className, ...props },
    ref,
  ) {
    const fieldProps = useFieldControl({ id, describedBy, invalid, required });
    return <select ref={ref} className={cn(controlClasses, className)} {...fieldProps} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea(
  { id, "aria-describedby": describedBy, "aria-invalid": invalid, required, className, ...props },
  ref,
) {
  const fieldProps = useFieldControl({ id, describedBy, invalid, required });
  return (
    <textarea
      ref={ref}
      className={cn(controlClasses, "min-h-28 resize-y", className)}
      {...fieldProps}
      {...props}
    />
  );
});
