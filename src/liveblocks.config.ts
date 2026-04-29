import { createClient } from "@liveblocks/client";

export const client = createClient({
  authEndpoint: "/api/liveblocks/auth",
});

declare global {
  interface Liveblocks {
    // Each user's Presence
    Presence: {
      cursor: { x: number; y: number } | null;
    };

    // The Storage block
    Storage: {
      // we don't store anything in Liveblocks Storage for now, we rely on Yjs
    };

    // User details (populated from authEndpoint)
    UserMeta: {
      id: string; // usually session ID or user ID
      info: {
        name: string;
        avatar: string;
      };
    };

    RoomEvent: Record<string, never>;
  }
}
