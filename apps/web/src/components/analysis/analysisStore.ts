// The analysis store of the workspace (card PX-02.8): one zustand store, separate from the model store, that
// holds the state of the live analysis. Its transitions are the pure reducer of ./analysisState.ts; the
// events come from ./runAnalysis.ts, started by ./LiveAnalysis.tsx while the workspace is mounted.
import { create } from "zustand";
import {
  type AnalysisEvent,
  type AnalysisState,
  INITIAL_ANALYSIS,
  reduceAnalysis,
} from "./analysisState";

export interface AnalysisStoreState {
  analysis: AnalysisState;
  /** Applies one event (`reduceAnalysis`). An event that changes nothing tells no subscriber. */
  dispatch: (event: AnalysisEvent) => void;
  /** What "Retry" runs: set by the running live analysis, `null` while none runs. */
  retryHandler: (() => void) | null;
  setRetryHandler: (handler: (() => void) | null) => void;
  /** Sends the model on screen again; nothing while no live analysis runs. */
  retry: () => void;
}

export const useAnalysisStore = create<AnalysisStoreState>((set, get) => ({
  analysis: INITIAL_ANALYSIS,
  dispatch: (event) =>
    set((state) => {
      const analysis = reduceAnalysis(state.analysis, event);
      return analysis === state.analysis ? state : { analysis };
    }),
  retryHandler: null,
  setRetryHandler: (retryHandler) => set({ retryHandler }),
  retry: () => get().retryHandler?.(),
}));
