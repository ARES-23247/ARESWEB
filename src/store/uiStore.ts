import { create } from 'zustand';

interface UIState {
  isCommandPaletteOpen: boolean;
  isSidebarOpen: boolean;
  isChatbotOpen: boolean;
  activeSeasonId: string | null;
  
  // Actions
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setChatbotOpen: (open: boolean) => void;
  toggleChatbot: () => void;
  setActiveSeasonId: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isCommandPaletteOpen: false,
  isSidebarOpen: false,
  isChatbotOpen: false,
  activeSeasonId: null,

  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setChatbotOpen: (open) => set({ isChatbotOpen: open }),
  toggleChatbot: () => set((state) => ({ isChatbotOpen: !state.isChatbotOpen })),
  setActiveSeasonId: (id) => set({ activeSeasonId: id }),
}));
