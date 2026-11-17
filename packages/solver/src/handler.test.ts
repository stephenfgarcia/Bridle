import { type Model, planarTruss, portalFrame } from "@bridle/model";
import { describe, expect, it } from "vitest";
import { handleSolveRequest, transferList } from "./handler";
import { isSolveRequest, isSolveResponse, type SolveRequest } from "./messages";
import { solve } from "./solve";

function twoLoadCases(): Model {
  const model = portalFrame();
  model.loadCases.push({ id: "lc2", name: "LC2" });
  model.nodalLoads.push({
    id: "nl2",
    loadCaseId: "lc2",
    nodeId: "n3",
    fx: 0,
    fy: 0,
    fz: -15,
    mx: 0,
    my: 0,
    mz: 0,
  });
  return model;
}

describe("handleSolveRequest", () => {
  it("answers with the request's id and the result of solve", () => {
    const { response } = handleSolveRequest({ type: "solve", id: 7, model: portalFrame() });
    expect(response).toEqual({ type: "solve-result", id: 7, result: solve(portalFrame()) });
  });

  it("lists the two Float64Array buffers of every load case for transfer, each once", () => {
    const { response, transfer } = handleSolveRequest({
      type: "solve",
      id: 1,
      model: twoLoadCases(),
    });
    if (response.type !== "solve-result" || !response.result.ok) {
      throw new Error("test: expected a solved result");
    }
    const { lc1, lc2 } = response.result.loadCases;
    expect(transfer).toHaveLength(4);
    expect(new Set(transfer).size).toBe(4);
    expect(new Set(transfer)).toEqual(
      new Set([
        lc1?.displacementVector.buffer,
        lc1?.reactionVector.buffer,
        lc2?.displacementVector.buffer,
        lc2?.reactionVector.buffer,
      ]),
    );
    for (const buffer of transfer) {
      expect(buffer).toBeInstanceOf(ArrayBuffer);
    }
  });

  it("the response survives a transfer: the copy equals a direct solve and the sender's arrays are emptied", () => {
    const { response, transfer } = handleSolveRequest({
      type: "solve",
      id: 2,
      model: twoLoadCases(),
    });
    const received = structuredClone(response, { transfer });
    expect(received).toEqual({ type: "solve-result", id: 2, result: solve(twoLoadCases()) });
    if (response.type !== "solve-result" || !response.result.ok) {
      throw new Error("test: expected a solved result");
    }
    for (const loadCase of Object.values(response.result.loadCases)) {
      expect(loadCase.displacementVector).toHaveLength(0);
      expect(loadCase.reactionVector).toHaveLength(0);
    }
    for (const buffer of transfer) {
      expect(buffer.byteLength).toBe(0);
    }
  });

  it("a refusal of solve is a solve-result with nothing to transfer", () => {
    const { response, transfer } = handleSolveRequest({
      type: "solve",
      id: 3,
      model: planarTruss(),
    });
    expect(response).toEqual({ type: "solve-result", id: 3, result: solve(planarTruss()) });
    expect(response.type === "solve-result" && response.result.ok).toBe(false);
    expect(transfer).toEqual([]);
    expect(transferList(solve(planarTruss()))).toEqual([]);
  });

  it("when solve throws an Error, the response is a solve-error with its name and message", () => {
    const { response, transfer } = handleSolveRequest(
      { type: "solve", id: 4, model: portalFrame() },
      () => {
        throw new RangeError("too large");
      },
    );
    expect(response).toEqual({
      type: "solve-error",
      id: 4,
      error: { name: "RangeError", message: "too large" },
    });
    expect(transfer).toEqual([]);
  });

  it("when solve throws a value that is not an Error, the message is the value as a string", () => {
    const { response } = handleSolveRequest({ type: "solve", id: 5, model: portalFrame() }, () => {
      throw "plain text";
    });
    expect(response).toEqual({
      type: "solve-error",
      id: 5,
      error: { name: "Error", message: "plain text" },
    });
  });

  it("a model that is not a model makes the real solve throw, and that becomes a solve-error", () => {
    const request = { type: "solve", id: 6, model: {} } as unknown as SolveRequest;
    const { response, transfer } = handleSolveRequest(request);
    expect(response.type).toBe("solve-error");
    expect(response.id).toBe(6);
    expect(isSolveResponse(response)).toBe(true);
    expect(transfer).toEqual([]);
  });

  it("the handler does not change the request's model", () => {
    const model = twoLoadCases();
    handleSolveRequest({ type: "solve", id: 8, model });
    expect(model).toEqual(twoLoadCases());
  });
});

describe("message guards", () => {
  it("isSolveRequest accepts a request and refuses other values", () => {
    expect(isSolveRequest({ type: "solve", id: 1, model: portalFrame() })).toBe(true);
    for (const value of [
      null,
      undefined,
      "solve",
      42,
      {},
      { type: "solve", id: "1", model: portalFrame() },
      { type: "solve", id: 1 },
      { type: "solve", id: 1, model: null },
      { type: "other", id: 1, model: portalFrame() },
    ]) {
      expect(isSolveRequest(value)).toBe(false);
    }
  });

  it("isSolveResponse accepts the two responses and refuses other values", () => {
    expect(isSolveResponse({ type: "solve-result", id: 1, result: solve(portalFrame()) })).toBe(
      true,
    );
    expect(
      isSolveResponse({ type: "solve-error", id: 1, error: { name: "Error", message: "m" } }),
    ).toBe(true);
    for (const value of [
      null,
      "solve-result",
      {},
      { type: "solve-result", id: 1 },
      { type: "solve-result", id: "1", result: {} },
      { type: "solve-error", id: 1, error: { name: "Error" } },
      { type: "solve-error", id: 1, error: "text" },
      { type: "solve", id: 1, model: portalFrame() },
    ]) {
      expect(isSolveResponse(value)).toBe(false);
    }
  });
});
