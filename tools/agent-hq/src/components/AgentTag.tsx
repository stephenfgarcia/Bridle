import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties } from "react";
import type { Agent } from "../data/types";
import { STATUS_META } from "../lib/status";
import { ProgressRing } from "./ProgressRing";
import { StatusIcon } from "./StatusIcon";

interface Props {
  agent: Agent;
}

/** The holographic name tag floating above a desk. */
export function AgentTag({ agent }: Props) {
  const meta = STATUS_META[agent.status];
  const style = { "--accent": agent.color, "--status": meta.color } as CSSProperties;
  return (
    <div className="tag" style={style}>
      <div className="tag-head">
        <span className="tag-name">{agent.name}</span>
        <span className="tag-role">{agent.role}</span>
      </div>
      <ProgressRing
        className="tag-ring"
        value={agent.progress}
        size={38}
        color={agent.status === "done" ? "#f4f2ff" : agent.color}
      />
      <div className="tag-line">
        <span className="tag-status">
          <StatusIcon status={agent.status} size={12} />
          {meta.label}
        </span>
        <span className="tag-task" title={agent.currentTask}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={agent.currentTask}
              className="tag-task-inner"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
            >
              {agent.currentTask}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>
    </div>
  );
}
