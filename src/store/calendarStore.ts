import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';
export type EventFilterType = 'all' | 'internal' | 'outreach' | 'external';

interface CalendarState {
  // View mode
  viewMode: CalendarViewMode;

  // Current date range being viewed
  currentDate: Date;

  // Filters
  eventFilter: EventFilterType;
  showExceptionsOnly: boolean;
  searchQuery: string;

  // UI state
  selectedEventId: string | null;
  selectedDate: Date | null;

  // Actions
  setViewMode: (mode: CalendarViewMode) => void;
  setCurrentDate: (date: Date) => void;
  goToDate: (date: Date) => void;
  goToToday: () => void;
  navigateMonth: (direction: 'prev' | 'next') => void;

  setEventFilter: (filter: EventFilterType) => void;
  toggleExceptionsOnly: () => void;
  setSearchQuery: (query: string) => void;

  selectEvent: (eventId: string | null) => void;
  selectDate: (date: Date | null) => void;

  resetFilters: () => void;
}

const defaultState: Omit<CalendarState, 'setViewMode' | 'setCurrentDate' | 'goToDate' | 'goToToday' | 'navigateMonth' | 'setEventFilter' | 'toggleExceptionsOnly' | 'setSearchQuery' | 'selectEvent' | 'selectDate' | 'resetFilters'> = {
  viewMode: 'month',
  currentDate: new Date(),
  eventFilter: 'all',
  showExceptionsOnly: false,
  searchQuery: '',
  selectedEventId: null,
  selectedDate: null,
};

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set) => ({
      ...defaultState,

      setViewMode: (mode) => set({ viewMode: mode }),

      setCurrentDate: (date) => set({ currentDate: date }),

      goToDate: (date) => set({ currentDate: date }),

      goToToday: () => set({ currentDate: new Date() }),

      navigateMonth: (direction) => set((state) => {
        const newDate = new Date(state.currentDate);
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        return { currentDate: newDate };
      }),

      setEventFilter: (filter) => set({ eventFilter: filter }),

      toggleExceptionsOnly: () => set((state) => ({ showExceptionsOnly: !state.showExceptionsOnly })),

      setSearchQuery: (query) => set({ searchQuery: query }),

      selectEvent: (eventId) => set({ selectedEventId: eventId }),

      selectDate: (date) => set({ selectedDate: date }),

      resetFilters: () => set({
        eventFilter: 'all',
        showExceptionsOnly: false,
        searchQuery: '',
      }),
    }),
    {
      name: 'ares-calendar-prefs',
      partialize: (state) => ({
        viewMode: state.viewMode,
        eventFilter: state.eventFilter,
        showExceptionsOnly: state.showExceptionsOnly,
      }),
    }
  )
);
