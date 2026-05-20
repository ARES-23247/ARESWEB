import type * as Party from "partykit/server";

export default class KanbanServer implements Party.Server {
  constructor(public room: Party.Room) {}

  async onConnect() {
    // We don't need any special connection logic since we are just doing pub-sub.
  }

  async onClose(connection: Party.Connection) {
    const state = connection.state as { userId?: string } | undefined;
    if (state?.userId) {
      this.room.broadcast(JSON.stringify({
        type: "leave",
        userId: state.userId
      }));
    }
  }

  async onMessage(message: string | ArrayBuffer, sender: Party.Connection) {
    // Kanban messages should all be JSON strings
    if (typeof message !== "string") return;

    try {
      // Validate that it's valid JSON
      const msg = JSON.parse(message);
      if (msg && typeof msg === "object" && msg.type === "presence") {
        sender.setState({ userId: msg.userId });
      }
      
      // Broadcast to all *other* connections in this room
      this.room.broadcast(message, [sender.id]);
    } catch {
      console.error("[KanbanServer] Received invalid JSON:", message);
    }
  }
}
