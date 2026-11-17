"use client";

import type { Model } from "@bridle/model";
import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import { t } from "../../i18n";
import styles from "./Viewport.module.css";

// three.js needs a browser: the canvas is loaded on the client only, so the server render and `next build`
// never evaluate it.
const ViewportCanvas = dynamic(() => import("./ViewportCanvas"), { ssr: false });

/** Shows `fallback` in place of a child that throws (a browser without WebGL). */
class CanvasBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * The 3D viewport of a model (card PX-02.2): the grid, the nodes, the members and the supports, with the camera
 * controls. It fills its parent, which must be positioned. The model is a prop; what is hovered and selected
 * is in ./viewportStore.ts.
 *
 * The camera frames the whole model when the viewport mounts and whenever `frameKey` changes (another model was
 * opened). A new `model` under the same key (an edit) is drawn where the camera stands.
 */
export function Viewport({ model, frameKey = "" }: { model: Model; frameKey?: string }) {
  return (
    <CanvasBoundary
      fallback={<p className={styles.unavailable}>{t("workspace.viewport.unavailable")}</p>}
    >
      <ViewportCanvas frameKey={frameKey} model={model} />
    </CanvasBoundary>
  );
}
