import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TaskViewMode = 'kanban' | 'table';
export type TaskFilterStatus = 'all' | 'todo' | 'in_progress' | 'done' | 'blocked';
export type TaskFilterPriority = 'all' | 'low' | 'normal' | 'high' | 'urgent';

interface TaskBoardState {
  // View Preferences
  viewMode: TaskViewMode;
  isFullscreen: boolean;
  isCreating: boolean;

  // Filters
  subteamFilter: string | null;
  statusFilter: TaskFilterStatus;
  priorityFilter: TaskFilterPriority;
  assigneeFilter: string | null;
  searchQuery: string;

  // Sorting
  sortBy: 'dueDate' | 'priority' | 'title' | 'created';
  sortDirection: 'asc' | 'desc';

  // Actions
  setViewMode: (mode: TaskViewMode) => void;
  setFullscreen: (open: boolean) => void;
  toggleFullscreen: () => void;
  setCreating: (creating: boolean) => void;

  setSubteamFilter: (subteam: string | null) => void;
  setStatusFilter: (status: TaskFilterStatus) => void;
  setPriorityFilter: (priority: TaskFilterPriority) => void;
  setAssigneeFilter: (assignee: string | null) => void;
  setSearchQuery: (query: string) => void;

  setSortBy: (sortBy: TaskBoardState['sortBy']) => void;
  setSortDirection: (direction: 'asc' | 'desc') => void;
  toggleSortDirection: () => void;

  resetFilters: () => void;
  resetAll: () => void;
}

const defaultState: Omit<TaskBoardState, 'setViewMode' | 'setFullscreen' | 'toggleFullscreen' | 'setCreating' | 'setSubteamFilter' | 'setStatusFilter' | 'setPriorityFilter' | 'setAssigneeFilter' | 'setSearchQuery' | 'setSortBy' | 'setSortDirection' | 'toggleSortDirection' | 'resetFilters' | 'resetAll'> = {
  viewMode: 'kanban',
  isFullscreen: false,
  isCreating: false,
  subteamFilter: null,
  statusFilter: 'all',
  priorityFilter: 'all',
  assigneeFilter: null,
  searchQuery: '',
  sortBy: 'dueDate',
  sortDirection: 'asc',
};

export const useTaskBoardStore = create<TaskBoardState>()(
  persist(
    (set) => ({
      ...defaultState,

      setViewMode: (mode) => set({ viewMode: mode }),
      setFullscreen: (open) => set({ isFullscreen: open }),
      toggleFullscreen: () => set((s) => ({ isFullscreen: !s.isFullscreen })),
      setCreating: (creating) => set({ isCreating: creating }),

      setSubteamFilter: (subteam) => set({ subteamFilter: subteam }),
      setStatusFilter: (status) => set({ statusFilter: status }),
      setPriorityFilter: (priority) => set({ priorityFilter: priority }),
      setAssigneeFilter: (assignee) => set({ assigneeFilter: assignee }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      setSortBy: (sortBy) => set({ sortBy }),
      setSortDirection: (direction) => set({ sortDirection: direction }),
      toggleSortDirection: () => set((s) => ({ sortDirection: s.sortDirection === 'asc' ? 'desc' : 'asc' })),

      resetFilters: () => set({
        subteamFilter: null,
        statusFilter: 'all',
        priorityFilter: 'all',
        assigneeFilter: null,
        searchQuery: '',
      }),

      resetAll: () => set(defaultState),
    }),
    {
      name: 'ares-task-board-prefs',
      partialize: (state) => ({
        viewMode: state.viewMode,
        isFullscreen: state.isFullscreen,
        subteamFilter: state.subteamFilter,
        statusFilter: state.statusFilter,
        priorityFilter: state.priorityFilter,
        assigneeFilter: state.assigneeFilter,
        searchQuery: state.searchQuery,
        sortBy: state.sortBy,
        sortDirection: state.sortDirection,
      }),
    }
  )
);
