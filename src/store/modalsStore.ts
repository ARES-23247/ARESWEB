import { create } from 'zustand';

export type ModalType =
  | 'videoPicker'
  | 'galleryPicker'
  | 'assetPicker'
  | 'simPicker'
  | 'locationPicker'
  | 'sponsorship'
  | 'taskDetails'
  | 'quickAddEvent'
  | 'broadcast'
  | 'prompt'
  | 'createLocation'
  | 'externalSources';

export interface ModalState {
  isOpen: boolean;
  data?: unknown;
}

interface ModalsState {
  // Individual modal states
  videoPicker: ModalState;
  galleryPicker: ModalState;
  assetPicker: ModalState;
  simPicker: ModalState;
  locationPicker: ModalState;
  sponsorship: ModalState;
  taskDetails: ModalState;
  quickAddEvent: ModalState;
  broadcast: ModalState;
  prompt: ModalState;
  createLocation: ModalState;
  externalSources: ModalState;

  // Generic modal state for dynamic modals
  activeModals: Set<ModalType>;

  // Actions
  openModal: (type: ModalType, data?: unknown) => void;
  closeModal: (type: ModalType) => void;
  closeAllModals: () => void;

  // Specific modal helpers with typing
  openVideoPicker: (data?: { onSelect?: (url: string) => void; multiple?: boolean }) => void;
  openGalleryPicker: (data?: { onSelect?: (id: string) => void; multiple?: boolean }) => void;
  openAssetPicker: (data?: { onSelect?: (asset: unknown) => void }) => void;
  openSimPicker: (data?: { onSelect?: (sim: string) => void }) => void;
  openLocationPicker: (data?: { onSelect?: (location: unknown) => void }) => void;
  openSponsorship: (data?: { taskId?: string }) => void;
  openTaskDetails: (data?: { taskId: string }) => void;
  openQuickAddEvent: (data?: { date?: Date }) => void;
  openBroadcast: () => void;
  openPrompt: (data?: { title?: string; message?: string; onConfirm?: () => void }) => void;
  openCreateLocation: () => void;
  openExternalSources: () => void;
}

const createModalState = (): ModalState => ({ isOpen: false, data: undefined });

export const useModalsStore = create<ModalsState>((set) => ({
  videoPicker: createModalState(),
  galleryPicker: createModalState(),
  assetPicker: createModalState(),
  simPicker: createModalState(),
  locationPicker: createModalState(),
  sponsorship: createModalState(),
  taskDetails: createModalState(),
  quickAddEvent: createModalState(),
  broadcast: createModalState(),
  prompt: createModalState(),
  createLocation: createModalState(),
  externalSources: createModalState(),
  activeModals: new Set<ModalType>(),

  openModal: (type, data) => set((state) => ({
    [type]: { isOpen: true, data },
    activeModals: new Set([...state.activeModals, type]),
  })),

  closeModal: (type) => set((state) => {
    const nextActive = new Set(state.activeModals);
    nextActive.delete(type);
    return {
      [type]: { isOpen: false, data: undefined },
      activeModals: nextActive,
    };
  }),

  closeAllModals: () => set({
    videoPicker: createModalState(),
    galleryPicker: createModalState(),
    assetPicker: createModalState(),
    simPicker: createModalState(),
    locationPicker: createModalState(),
    sponsorship: createModalState(),
    taskDetails: createModalState(),
    quickAddEvent: createModalState(),
    broadcast: createModalState(),
    prompt: createModalState(),
    createLocation: createModalState(),
    externalSources: createModalState(),
    activeModals: new Set(),
  }),

  // Specific helpers
  openVideoPicker: (data) => set((state) => ({
    videoPicker: { isOpen: true, data },
    activeModals: new Set([...state.activeModals, 'videoPicker']),
  })),
  openGalleryPicker: (data) => set((state) => ({
    galleryPicker: { isOpen: true, data },
    activeModals: new Set([...state.activeModals, 'galleryPicker']),
  })),
  openAssetPicker: (data) => set((state) => ({
    assetPicker: { isOpen: true, data },
    activeModals: new Set([...state.activeModals, 'assetPicker']),
  })),
  openSimPicker: (data) => set((state) => ({
    simPicker: { isOpen: true, data },
    activeModals: new Set([...state.activeModals, 'simPicker']),
  })),
  openLocationPicker: (data) => set((state) => ({
    locationPicker: { isOpen: true, data },
    activeModals: new Set([...state.activeModals, 'locationPicker']),
  })),
  openSponsorship: (data) => set((state) => ({
    sponsorship: { isOpen: true, data },
    activeModals: new Set([...state.activeModals, 'sponsorship']),
  })),
  openTaskDetails: (data) => set((state) => ({
    taskDetails: { isOpen: true, data },
    activeModals: new Set([...state.activeModals, 'taskDetails']),
  })),
  openQuickAddEvent: (data) => set((state) => ({
    quickAddEvent: { isOpen: true, data },
    activeModals: new Set([...state.activeModals, 'quickAddEvent']),
  })),
  openBroadcast: () => set((state) => ({
    broadcast: { isOpen: true, data: undefined },
    activeModals: new Set([...state.activeModals, 'broadcast']),
  })),
  openPrompt: (data) => set((state) => ({
    prompt: { isOpen: true, data },
    activeModals: new Set([...state.activeModals, 'prompt']),
  })),
  openCreateLocation: () => set((state) => ({
    createLocation: { isOpen: true, data: undefined },
    activeModals: new Set([...state.activeModals, 'createLocation']),
  })),
  openExternalSources: () => set((state) => ({
    externalSources: { isOpen: true, data: undefined },
    activeModals: new Set([...state.activeModals, 'externalSources']),
  })),
}));
