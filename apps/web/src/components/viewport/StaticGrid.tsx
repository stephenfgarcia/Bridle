"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";

// three.js needs a browser: the canvas is loaded on the client only, so the server render and `next build`
// never evaluate it.
const StaticGridCanvas = dynamic(() => import("./StaticGridCanvas"), { ssr: false });

/** Renders nothing in place of a child that throws (a browser without WebGL): the viewport area stays empty. */
class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** The 3D proof of card PX-02.1: one static grid. Card W2 replaces it with the viewport. */
export function StaticGrid() {
  return (
    <CanvasBoundary>
      <StaticGridCanvas />
    </CanvasBoundary>
  );
}
