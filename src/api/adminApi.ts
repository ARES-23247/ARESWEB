import { PostPayload } from "../schemas/postSchema";
import { EventPayload } from "../schemas/eventSchema";
import { DocPayload } from "../schemas/docSchema";
import { OutreachPayload } from "../schemas/outreachSchema";
import { LocationPayload } from "../schemas/locationSchema";
import { BadgePayload } from "../schemas/badgeSchema";
import { SponsorPayload } from "../schemas/sponsorSchema";
import { IntegrationPayload } from "../schemas/integrationSchema";
import { fetchJson, uploadFile, fetchBlob } from "../utils/apiClient";

export const adminApi = {
  // --- DATA FETCHERS (Generic GET/REQUEST wrapper) ---
  get: async <T>(url: string, options?: RequestInit): Promise<T> => {
    return fetchJson<T>(url, { method: "GET", ...options });
  },
  request: async <T>(url: string, options?: RequestInit): Promise<T> => {
    return fetchJson<T>(url, options);
  },
  uploadFile: async <T>(url: string, formData: FormData): Promise<T> => {
    return uploadFile<T>(url, formData);
  },
  downloadFile: async (url: string, options?: RequestInit): Promise<Blob> => {
    return fetchBlob(url, options);
  },

  // --- POSTS ---
  createPost: async (payload: PostPayload) => {
    return fetchJson<{ success?: boolean, slug?: string, warning?: string, error?: string }>("/api/admin/posts/save", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updatePost: async (slug: string, payload: PostPayload) => {
    return fetchJson<{ success?: boolean, slug?: string, warning?: string, error?: string }>(`/api/admin/posts/${slug}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  deletePost: async (slug: string) => {
    return fetchJson<{ success?: boolean, error?: string }>(`/api/admin/posts/${slug}`, {
      method: "DELETE",
    });
  },

  // --- EVENTS ---
  createEvent: async (payload: EventPayload) => {
    return fetchJson<{ success?: boolean, id?: string, warning?: string, error?: string }>("/api/admin/events", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateEvent: async (id: string, payload: EventPayload) => {
    return fetchJson<{ success?: boolean, id?: string, warning?: string, error?: string }>(`/api/admin/events/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  deleteEvent: async (id: string) => {
    return fetchJson<{ success?: boolean, error?: string }>(`/api/admin/events/${id}`, {
      method: "DELETE",
    });
  },

  // --- DOCS ---
  createDoc: async (payload: DocPayload) => {
    return fetchJson<{ success?: boolean, slug?: string, error?: string }>("/api/admin/docs/save", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateDoc: async (payload: DocPayload) => {
    return fetchJson<{ success?: boolean, slug?: string, error?: string }>("/api/admin/docs/save", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  deleteDoc: async (slug: string) => {
    return fetchJson<{ success?: boolean, error?: string }>(`/api/admin/docs/${slug}`, {
      method: "DELETE",
    });
  },

  // --- OUTREACH ---
  createOutreach: async (payload: OutreachPayload) => {
    return fetchJson<{ success?: boolean }>("/api/admin/outreach", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  deleteOutreach: async (id: string) => {
    return fetchJson<{ success?: boolean }>(`/api/admin/outreach/${id}`, {
      method: "DELETE",
    });
  },

  // --- LOCATIONS ---
  createLocation: async (payload: LocationPayload) => {
    return fetchJson<{ success?: boolean }>("/api/admin/locations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateLocation: async (id: string, payload: LocationPayload) => {
    return fetchJson<{ success?: boolean }>(`/api/admin/locations/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  deleteLocation: async (id: string) => {
    return fetchJson<{ success?: boolean }>(`/api/admin/locations/${id}`, {
      method: "DELETE",
    });
  },

  // --- BADGES ---
  createBadge: async (payload: BadgePayload) => {
    return fetchJson<{ success?: boolean }>("/api/admin/badges/save", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  deleteBadge: async (id: string) => {
    return fetchJson<{ success?: boolean }>(`/api/admin/badges/${id}`, {
      method: "DELETE",
    });
  },
  grantBadge: async (userId: string, badgeId: string) => {
    return fetchJson<{ success?: boolean }>(`/api/admin/badges/users/${userId}/award`, {
      method: "POST",
      body: JSON.stringify({ badge_id: badgeId }),
    });
  },
  revokeBadge: async (userId: string, badgeId: string) => {
    return fetchJson<{ success?: boolean }>(`/api/admin/badges/users/${userId}/${badgeId}/revoke`, {
      method: "DELETE",
    });
  },

  // --- SPONSORS ---
  createSponsor: async (payload: SponsorPayload) => {
    return fetchJson<{ success?: boolean }>("/api/sponsors/admin", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateSponsor: async (id: string, payload: SponsorPayload) => {
    return fetchJson<{ success?: boolean }>("/api/sponsors/admin", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  deleteSponsor: async (id: string) => {
    return fetchJson<{ success?: boolean }>(`/api/sponsors/admin/${id}`, {
      method: "DELETE",
    });
  },

  // --- INTEGRATIONS ---
  updateIntegrations: async (payload: IntegrationPayload) => {
    return fetchJson<{ success?: boolean }>("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // --- MEDIA / ASSETS ---
  deleteMedia: async (key: string) => {
    return fetchJson<{ success?: boolean }>(`/api/admin/media/${key}`, {
      method: "DELETE",
    });
  },
  moveMedia: async (key: string, folder: string) => {
    return fetchJson<{ success?: boolean }>(`/api/admin/media/move/${key}`, {
      method: "PUT",
      body: JSON.stringify({ folder }),
    });
  },
  syndicateMedia: async (key: string, caption: string) => {
    return fetchJson<{ success?: boolean }>(`/api/admin/media/syndicate`, {
      method: "POST",
      body: JSON.stringify({ key, caption }),
    });
  },

  // --- INQUIRIES ---
  updateInquiryStatus: async (id: string, status: string) => {
    return fetchJson<{ success?: boolean }>(`/api/inquiries/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },
  deleteInquiry: async (id: string) => {
    return fetchJson<{ success?: boolean }>(`/api/inquiries/${id}`, {
      method: "DELETE",
    });
  }
};
