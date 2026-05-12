import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SidebarType = 'dashboard' | 'docs' | 'docsAcademy' | 'editor' | 'admin';

interface SidebarState {
  // Dashboard Sidebar
  dashboardOpen: boolean;
  dashboardActiveTab: string;

  // Docs Sidebar
  docsOpen: boolean;
  docsExpandedCategories: Set<string>;
  docsSearchOpen: boolean;
  docsAcademyOpen: boolean;
  docsAcademyExpandedCategories: Set<string>;

  // Editor Sidebar
  editorVersionHistoryOpen: boolean;
  editorChatOpen: boolean;

  // Admin Panel
  adminSidebarOpen: boolean;

  // Actions
  setDashboardOpen: (open: boolean) => void;
  toggleDashboard: () => void;
  setDashboardActiveTab: (tab: string) => void;

  setDocsOpen: (open: boolean) => void;
  toggleDocs: () => void;
  toggleDocsCategory: (category: string) => void;
  setDocsExpandedCategories: (categories: Set<string>) => void;
  setDocsSearchOpen: (open: boolean) => void;

  setDocsAcademyOpen: (open: boolean) => void;
  toggleDocsAcademy: () => void;
  toggleDocsAcademyCategory: (category: string) => void;
  setDocsAcademyExpandedCategories: (categories: Set<string>) => void;

  setEditorVersionHistoryOpen: (open: boolean) => void;
  toggleEditorVersionHistory: () => void;
  setEditorChatOpen: (open: boolean) => void;
  toggleEditorChat: () => void;

  setAdminSidebarOpen: (open: boolean) => void;
  toggleAdminSidebar: () => void;

  closeAllSidebars: () => void;
}

const defaultState: Omit<SidebarState, 'setDashboardOpen' | 'toggleDashboard' | 'setDashboardActiveTab' | 'setDocsOpen' | 'toggleDocs' | 'toggleDocsCategory' | 'setDocsExpandedCategories' | 'setDocsSearchOpen' | 'setDocsAcademyOpen' | 'toggleDocsAcademy' | 'toggleDocsAcademyCategory' | 'setDocsAcademyExpandedCategories' | 'setEditorVersionHistoryOpen' | 'toggleEditorVersionHistory' | 'setEditorChatOpen' | 'toggleEditorChat' | 'setAdminSidebarOpen' | 'toggleAdminSidebar' | 'closeAllSidebars'> = {
  dashboardOpen: false,
  dashboardActiveTab: 'overview',
  docsOpen: false,
  docsExpandedCategories: new Set(),
  docsSearchOpen: false,
  docsAcademyOpen: false,
  docsAcademyExpandedCategories: new Set(),
  editorVersionHistoryOpen: false,
  editorChatOpen: false,
  adminSidebarOpen: true,
};

// Helper to serialize Set for persistence
const serializeSet = (set: Set<string>) => Array.from(set);
const deserializeSet = (arr: string[]) => new Set(arr);

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      ...defaultState,

      setDashboardOpen: (open) => set({ dashboardOpen: open }),
      toggleDashboard: () => set((s) => ({ dashboardOpen: !s.dashboardOpen })),
      setDashboardActiveTab: (tab) => set({ dashboardActiveTab: tab }),

      setDocsOpen: (open) => set({ docsOpen: open }),
      toggleDocs: () => set((s) => ({ docsOpen: !s.docsOpen })),
      toggleDocsCategory: (category) => set((s) => {
        const next = new Set(s.docsExpandedCategories);
        if (next.has(category)) next.delete(category);
        else next.add(category);
        return { docsExpandedCategories: next };
      }),
      setDocsExpandedCategories: (categories) => set({ docsExpandedCategories: categories }),
      setDocsSearchOpen: (open) => set({ docsSearchOpen: open }),

      setDocsAcademyOpen: (open) => set({ docsAcademyOpen: open }),
      toggleDocsAcademy: () => set((s) => ({ docsAcademyOpen: !s.docsAcademyOpen })),
      toggleDocsAcademyCategory: (category) => set((s) => {
        const next = new Set(s.docsAcademyExpandedCategories);
        if (next.has(category)) next.delete(category);
        else next.add(category);
        return { docsAcademyExpandedCategories: next };
      }),
      setDocsAcademyExpandedCategories: (categories) => set({ docsAcademyExpandedCategories: categories }),

      setEditorVersionHistoryOpen: (open) => set({ editorVersionHistoryOpen: open }),
      toggleEditorVersionHistory: () => set((s) => ({ editorVersionHistoryOpen: !s.editorVersionHistoryOpen })),
      setEditorChatOpen: (open) => set({ editorChatOpen: open }),
      toggleEditorChat: () => set((s) => ({ editorChatOpen: !s.editorChatOpen })),

      setAdminSidebarOpen: (open) => set({ adminSidebarOpen: open }),
      toggleAdminSidebar: () => set((s) => ({ adminSidebarOpen: !s.adminSidebarOpen })),

      closeAllSidebars: () => set({
        dashboardOpen: false,
        docsOpen: false,
        docsAcademyOpen: false,
        editorVersionHistoryOpen: false,
        editorChatOpen: false,
      }),
    }),
    {
      name: 'ares-sidebar-state',
      partialize: (state) => ({
        dashboardOpen: state.dashboardOpen,
        dashboardActiveTab: state.dashboardActiveTab,
        docsExpandedCategories: serializeSet(state.docsExpandedCategories),
        docsAcademyExpandedCategories: serializeSet(state.docsAcademyExpandedCategories),
        editorVersionHistoryOpen: state.editorVersionHistoryOpen,
        editorChatOpen: state.editorChatOpen,
        adminSidebarOpen: state.adminSidebarOpen,
      }),
      merge: (persistedState: unknown, currentState: SidebarState) => ({
        ...currentState,
        ...(persistedState as Partial<SidebarState>),
        docsExpandedCategories: deserializeSet((persistedState as SidebarState)?.docsExpandedCategories as unknown as string[] ?? []),
        docsAcademyExpandedCategories: deserializeSet((persistedState as SidebarState)?.docsAcademyExpandedCategories as unknown as string[] ?? []),
      }),
    }
  )
);
