import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  // Command Palette
  isCommandPaletteOpen: boolean;

  // Chatbot
  isChatbotOpen: boolean;

  // Active Season (filters across app)
  activeSeasonId: string | null;

  // Theme
  theme: 'dark' | 'light';

  // Actions
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setChatbotOpen: (open: boolean) => void;
  toggleChatbot: () => void;
  setActiveSeasonId: (id: string | null) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isCommandPaletteOpen: false,
      isChatbotOpen: false,
      activeSeasonId: null,
      theme: 'dark',

      setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
      toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),

      setChatbotOpen: (open) => set({ isChatbotOpen: open }),
      toggleChatbot: () => set((state) => ({ isChatbotOpen: !state.isChatbotOpen })),

      setActiveSeasonId: (id) => set({ activeSeasonId: id }),

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
    }),
    {
      name: 'ares-ui-state',
      partialize: (state) => ({
        activeSeasonId: state.activeSeasonId,
        theme: state.theme,
      }),
    }
  )
);
