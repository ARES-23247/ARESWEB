import { Store } from '@tanstack/react-store';

export interface UserPresence {
  userId: string;
  name: string;
  image?: string;
  lastSeen: number;
  x?: number;
  y?: number;
}

export interface KanbanState {
  activeUsers: Record<string, UserPresence>;
}

export const kanbanStore = new Store<KanbanState>({
  activeUsers: {},
});

export const kanbanActions = {
  updateUser: (userId: string, data: Partial<UserPresence>) => {
    kanbanStore.setState((state: KanbanState) => ({
      ...state,
      activeUsers: {
        ...state.activeUsers,
        [userId]: {
          ...(state.activeUsers[userId] || { userId, lastSeen: Date.now() }),
          ...data,
          lastSeen: Date.now(),
        },
      },
    }));
  },

  removeUser: (userId: string) => {
    kanbanStore.setState((state: KanbanState) => {
      const nextUsers = { ...state.activeUsers };
      delete nextUsers[userId];
      return {
        ...state,
        activeUsers: nextUsers,
      };
    });
  },

  clearStaleUsers: (timeoutMs: number = 60000) => {
    kanbanStore.setState((state: KanbanState) => {
      const now = Date.now();
      const nextUsers = { ...state.activeUsers };
      let changed = false;

      for (const [id, user] of Object.entries(nextUsers)) {
        if (now - (user as UserPresence).lastSeen > timeoutMs) {
          delete nextUsers[id];
          changed = true;
        }
      }

      if (!changed) return state;
      return {
        ...state,
        activeUsers: nextUsers,
      };
    });
  },
};
