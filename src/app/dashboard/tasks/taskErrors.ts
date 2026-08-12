export interface TaskOperationError {
  title: string;
  message: string;
  diagnostic: string;
}

interface ErrorDetails {
  code?: string;
  message: string;
  status?: number;
}

function getErrorDetails(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    const firebaseError = error as Error & { code?: unknown; status?: unknown };
    return {
      code: typeof firebaseError.code === "string" ? firebaseError.code : undefined,
      message: error.message,
      status: typeof firebaseError.status === "number" ? firebaseError.status : undefined,
    };
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    return {
      code: typeof record.code === "string" ? record.code : undefined,
      message: typeof record.message === "string" ? record.message : String(error),
      status: typeof record.status === "number" ? record.status : undefined,
    };
  }

  return { message: String(error) };
}

export function describeTaskError(action: string, error: unknown): TaskOperationError {
  const details = getErrorDetails(error);
  const searchable = `${details.code ?? ""} ${details.status ?? ""} ${details.message}`.toLowerCase();
  const title = `Unable to ${action}`;

  let message = "The change was not saved. Check your connection, then try again.";
  if (searchable.includes("unauthenticated") || searchable.includes("401")) {
    message = "Your session may have expired. Sign in again, then retry this action.";
  } else if (searchable.includes("permission-denied") || searchable.includes("forbidden") || searchable.includes("403")) {
    message = "Your account does not have permission for this action. Ask a coach or administrator for access.";
  } else if (searchable.includes("not-found")) {
    message = "This task no longer exists. Refresh the board before trying again.";
  } else if (searchable.includes("aborted") || searchable.includes("conflict")) {
    message = "Another teammate changed this task at the same time. Refresh and retry your change.";
  }

  const status = details.status ? `HTTP ${details.status}` : details.code;
  return {
    title,
    message,
    diagnostic: [status, details.message].filter(Boolean).join(": "),
  };
}
