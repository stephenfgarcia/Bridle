"use client";

import type { Model } from "@bridle/model";
import type { LoadCaseResult, SolveResult } from "@bridle/solver";
import { useMemo, useRef } from "react";
import { shownResults } from "../analysis/analysisState";
import { useAnalysisStore } from "../analysis/analysisStore";
import { useToolStore } from "../tools/toolStore";
import { activeLoadCaseId } from "./loads";
import {
  type DeflectedLines,
  deflectedLines,
  displacedPoint,
  type HeldScale,
  idealScale,
  type LargestDisplacement,
  largestDisplacement,
  modelSize,
  nextAutoScale,
  type ReactionGlyph,
  reactionGlyphs,
} from "./resultDrawing";
import type { Point3 } from "./scene";
import { useViewportStore } from "./viewportStore";

// The last largest displacement computed: the viewport and the Results section ask for the same one.
let lastLargest: {
  model: Model;
  result: SolveResult;
  loadCaseId: string;
  largest: LargestDisplacement | null;
} | null = null;

/**
 * `largestDisplacement` of ./resultDrawing.ts, computed once for the same model object, result object and
 * load case in a row.
 */
export function largestDisplacementOf(
  model: Model,
  result: SolveResult,
  loadCaseId: string,
): LargestDisplacement | null {
  if (
    lastLargest === null ||
    lastLargest.model !== model ||
    lastLargest.result !== result ||
    lastLargest.loadCaseId !== loadCaseId
  ) {
    lastLargest = {
      model,
      result,
      loadCaseId,
      largest: largestDisplacement(model, result, loadCaseId),
    };
  }
  return lastLargest.largest;
}

/** What the viewport draws for the results beside the model on screen (card PX-02.9). */
export interface ResultDrawing {
  /** The model the results were computed for: the points of the drawing are points of this model. */
  model: Model;
  /** Whether the results belong to an earlier model and the answer for the one on screen is awaited. */
  stale: boolean;
  /** The scale of the deflected shape in use. */
  scale: number;
  /** Whether that scale is the automatic one. */
  automatic: boolean;
  /** The deflected shape; `null` while "Deflected shape" is off. */
  deflected: DeflectedLines | null;
  /** The largest displacement and where its label goes on the deflected curve; `null` when nothing moves. */
  largest: { found: LargestDisplacement; labelPoint: Point3 } | null;
  /** The arrows and arcs of the reactions; empty while "Reactions" is off. */
  reactions: ReactionGlyph[];
}

/**
 * The results to draw beside `model`, the model on screen: `null` while there are none (`shownResults` of
 * ../analysis/analysisState.ts gives nothing: the model has issues, is unstable or not supported, the call
 * failed) or while the result has no entry for the active load case. Everything is computed for the model
 * the result belongs to, on the main thread, when that model, the result, the load case, the scale or one of
 * the two switches changes, not per drawn frame.
 *
 * `frameKey` is the key of the opened model (../model/modelStore.ts): with the load case it says what the
 * automatic scale belongs to, so that another model or another load case gets a scale of its own.
 */
export function useResultDrawing(model: Model, frameKey: string): ResultDrawing | null {
  const analysis = useAnalysisStore((state) => state.analysis);
  const chosenLoadCase = useToolStore((state) => state.loadCaseId);
  const showDeflected = useViewportStore((state) => state.showDeflected);
  const showReactions = useViewportStore((state) => state.showReactions);
  const scaleChoice = useViewportStore((state) => state.scaleChoice);
  const shown = shownResults(analysis, model);
  const solvedModel = shown?.model ?? null;
  const result = shown?.result ?? null;
  const stale = shown?.stale ?? false;
  const loadCaseId = activeLoadCaseId(model, chosenLoadCase);
  const loadCase: LoadCaseResult | null =
    result?.ok && loadCaseId !== null && Object.hasOwn(result.loadCases, loadCaseId)
      ? (result.loadCases[loadCaseId] ?? null)
      : null;

  const largest = useMemo(
    () =>
      solvedModel !== null && result !== null && loadCase !== null
        ? largestDisplacementOf(solvedModel, result, loadCase.loadCaseId)
        : null,
    [solvedModel, result, loadCase],
  );

  // The automatic scale that is held (`nextAutoScale`). The rule gives the same answer when it is asked twice
  // for the same input, so a render that runs twice changes nothing.
  const held = useRef<HeldScale | null>(null);
  const key = `${frameKey}\n${loadCaseId ?? ""}`;
  const ideal =
    solvedModel !== null && largest !== null
      ? idealScale(modelSize(solvedModel), largest.value)
      : null;
  const automaticScale = useMemo(() => {
    if (loadCase === null) {
      // Nothing is drawn: the held scale stays for when the results come back.
      return held.current?.scale ?? 1;
    }
    held.current = nextAutoScale(held.current, key, ideal);
    return held.current.scale;
  }, [loadCase, key, ideal]);
  const scale = scaleChoice.mode === "manual" ? scaleChoice.value : automaticScale;

  const deflected = useMemo(
    () =>
      showDeflected && solvedModel !== null && result !== null && loadCase !== null
        ? deflectedLines(solvedModel, result, loadCase.loadCaseId, scale)
        : null,
    [showDeflected, solvedModel, result, loadCase, scale],
  );
  const reactions = useMemo(
    () =>
      showReactions && solvedModel !== null && result?.ok && loadCase !== null
        ? reactionGlyphs(solvedModel, loadCase, result.nodeIds)
        : [],
    [showReactions, solvedModel, result, loadCase],
  );
  const marked = useMemo(
    () =>
      largest === null ? null : { found: largest, labelPoint: displacedPoint(largest, scale) },
    [largest, scale],
  );

  return useMemo(
    () =>
      loadCase === null || solvedModel === null
        ? null
        : {
            model: solvedModel,
            stale,
            scale,
            automatic: scaleChoice.mode === "auto",
            deflected,
            largest: marked,
            reactions,
          },
    [loadCase, solvedModel, stale, scale, scaleChoice.mode, deflected, marked, reactions],
  );
}
