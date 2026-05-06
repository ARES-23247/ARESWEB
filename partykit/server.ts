import type * as Party from "partykit/server";
import { onConnect } from "y-partykit";

/**
 * ARES PartyKit Yjs Server (Cloudflare Worker Mode)
 *
 * Provides real-time collaborative editing via WebSocket + Yjs CRDT.
 * Uses PartyKit's built-in snapshot persistence for document state.
 */
export default class YjsServer implements Party.Server {
  constructor(public room: Party.Room) {}

  /**
   * Handle HTTP requests (health checks, status probes).
   * Without this handler, PartyKit returns 500 for non-WebSocket requests.
   */
  async onRequest() {
    return new Response(
      JSON.stringify({
        status: "ok",
        room: this.room.id,
        connections: [...this.room.getConnections()].length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  async onConnect(conn: Party.Connection) {
    // Validate room ID format to prevent potential abuse (CR-09)
    // Allow colons for namespaced rooms like "blog:post-slug" or "docs:page-name"
    const roomId = this.room.id;
    if (!/^[a-zA-Z0-9_:-]{1,100}$/.test(roomId)) {
      throw new Error(`Invalid room_id format: ${roomId}`);
    }

    try {
      await onConnect(conn, this.room, {
        // Use explicit snapshot persistence (persist: true is deprecated)
        // See: https://docs.partykit.io/reference/y-partykit-api/#persistence
        persist: { mode: "snapshot" },
      });
      console.log(`[YjsServer] successfully connected and persisted room: ${roomId}`);
    } catch (e) {
      console.error(`[YjsServer] Error during onConnect for room ${roomId}:`, e);
      throw e;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onMessage(message: string | ArrayBuffer, _connection: Party.Connection) {
    const objMessage = message as unknown as Record<string, unknown>;
    const constructorName = objMessage && objMessage.constructor ? (objMessage.constructor as { name: string }).name : 'null';
    console.log(`[PartyKit-onMessage] message type: ${typeof message}, proto: ${Object.prototype.toString.call(message)}, constructor: ${constructorName}`);
    if (message instanceof ArrayBuffer) {
      console.log(`[PartyKit-onMessage] ArrayBuffer byteLength:`, message.byteLength);
    } else if (message instanceof Uint8Array) {
      console.log(`[PartyKit-onMessage] Uint8Array length:`, message.length);
    } else if (typeof message === "object" && message !== null) {
      console.log(`[PartyKit-onMessage] Keys:`, Object.keys(message));
    }
  }
}
