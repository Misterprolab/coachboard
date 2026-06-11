import { create } from 'zustand';

interface DiagramStore {
  pendingDiagram: string | null;
  setPendingDiagram: (svg: string | null) => void;
}

export const useDiagramStore = create<DiagramStore>((set) => ({
  pendingDiagram: null,
  setPendingDiagram: (svg) => set({ pendingDiagram: svg }),
}));
