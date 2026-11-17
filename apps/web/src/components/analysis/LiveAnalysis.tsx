"use client";

import { createSolverClient } from "@bridle/solver/client";
import { useEffect } from "react";
import { issuesOf, selectModel, useModelStore } from "../model/modelStore";
import { useAnalysisStore } from "./analysisStore";
import { startLiveAnalysis } from "./runAnalysis";
import { makeSolverWorker } from "./solverWorker";

/**
 * Runs the live analysis while it is mounted (card PX-02.8); it renders nothing. On mount it makes a solver
 * client, analyses the model of the model store and subscribes to that store once; every later model object
 * is analysed in turn (./runAnalysis.ts). The client makes its worker at the first model it sends. On
 * unmount the subscription ends, the client is disposed (its worker is terminated) and the analysis store
 * goes back to its initial state.
 *
 * Each run of the effect has a client of its own, so the second run that React's strict mode makes in
 * development starts with a fresh client, not with the one the first run's cleanup disposed.
 */
export function LiveAnalysis() {
  useEffect(() => {
    const client = createSolverClient(makeSolverWorker);
    const { dispatch, setRetryHandler } = useAnalysisStore.getState();
    const live = startLiveAnalysis({
      client,
      getModel: () => selectModel(useModelStore.getState()),
      subscribe: (listener) => useModelStore.subscribe(listener),
      issuesOf,
      dispatch,
    });
    setRetryHandler(live.retry);
    return () => {
      live.stop();
      client.dispose();
      setRetryHandler(null);
      dispatch({ type: "reset" });
    };
  }, []);
  return null;
}
