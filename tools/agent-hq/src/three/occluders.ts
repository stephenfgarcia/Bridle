/** Walls that can hide agent tags. Registered after mount so every ref is populated. */
import type { RefObject } from "react";
import { useEffect } from "react";
import type { Object3D } from "three";

const refs: RefObject<Object3D | null>[] = [];

export function useOccluder(ref: RefObject<Object3D | null>): void {
  useEffect(() => {
    refs.push(ref);
    return () => {
      const i = refs.indexOf(ref);
      if (i >= 0) refs.splice(i, 1);
    };
  }, [ref]);
}

/** The list drei's Html accepts; refs are only registered once their objects exist. */
export function occluderRefs(): RefObject<Object3D>[] {
  return refs as RefObject<Object3D>[];
}
