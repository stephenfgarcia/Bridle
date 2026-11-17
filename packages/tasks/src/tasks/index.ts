import type { Task } from "../types";
import { chooseTheBeamTask } from "./chooseTheBeam";
import { portalFrameTask } from "./portalFrame";
import { simplySupportedBeamTask } from "./simplySupportedBeam";

export * from "./chooseTheBeam";
export * from "./portalFrame";
export * from "./simplySupportedBeam";

/** The three seeded tasks, in the order a learner meets them. Each call returns new objects. */
export function seededTasks(): Task[] {
  return [simplySupportedBeamTask(), portalFrameTask(), chooseTheBeamTask()];
}
