import { InquiryPayload } from "../schemas/inquirySchema";
import { CommentPayload } from "../schemas/commentSchema";

// Generic JSON fetcher with error handling
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    // Include credentials for comments or other logged-in public actions
    credentials: "include",
  });
  
  if (!res.ok && res.status !== 207) {
    let errorMessage = `HTTP error! status: ${res.status}`;
    try {
      const errorData = await res.json() as Record<string, unknown>;
      if (errorData.error) {
        if (typeof errorData.error === "string") {
          errorMessage = errorData.error;
        } else if (typeof errorData.error === "object" && errorData.error !== null) {
          const errObj = errorData.error as Record<string, unknown>;
          if (Array.isArray(errObj.issues)) {
            errorMessage = errObj.issues.map((i: unknown) => {
              const issue = i as { path?: string[]; message?: string };
              return `${issue.path ? issue.path.join('.') + ': ' : ''}${issue.message}`;
            }).join(", ");
          } else if (typeof errObj.message === "string") {
            errorMessage = errObj.message;
          } else {
            errorMessage = JSON.stringify(errObj);
          }
        }
      } else if (typeof errorData.message === "string") {
        errorMessage = errorData.message;
      }
    } catch {
      // Ignored
    }
    throw new Error(errorMessage);
  }
  
  return res.json() as Promise<T>;
}

export const publicApi = {
  // --- INQUIRIES ---
  submitInquiry: async (payload: InquiryPayload) => {
    return fetchJson<{ success?: boolean }>("/api/inquiries", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // --- COMMENTS ---
  submitComment: async (targetType: string, targetId: string, payload: CommentPayload) => {
    return fetchJson<{ success?: boolean }>(`/api/comments/${targetType}/${targetId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateComment: async (commentId: string, payload: CommentPayload) => {
    return fetchJson<{ success?: boolean }>(`/api/comments/${commentId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  deleteComment: async (commentId: string) => {
    return fetchJson<{ success?: boolean }>(`/api/comments/${commentId}`, {
      method: "DELETE",
    });
  },

  // --- DATA FETCHERS (Generic GET wrapper) ---
  get: async <T>(url: string, options?: RequestInit): Promise<T> => {
    return fetchJson<T>(url, { method: "GET", ...options });
  },
  request: async <T>(url: string, options?: RequestInit): Promise<T> => {
    return fetchJson<T>(url, options);
  },

  // --- DOCS ---
  submitDocsFeedback: async (slug: string, isHelpful: boolean, turnstileToken: string, comment?: string) => {
    return fetchJson<{ success?: boolean }>(`/api/docs/${slug}/feedback`, {
      method: "POST",
      body: JSON.stringify({ isHelpful, comment, turnstileToken }),
    });
  },

  // --- JUDGES ---
  judgesLogin: async (code: string, turnstileToken: string) => {
    return fetchJson<{ success: boolean, error?: string }>("/api/judges/login", {
      method: "POST",
      body: JSON.stringify({ code, turnstileToken }),
    });
  },

  // --- ANALYTICS ---
  trackAnalytics: async (endpoint: string, payload: unknown) => {
    return fetchJson<{ success?: boolean }>(`/api/analytics/${endpoint}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};
