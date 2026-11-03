import { AnimatePresence, motion } from "motion/react";
import { type CSSProperties, useEffect, useId } from "react";
import type { Agent } from "../data/types";
import { useNow } from "../lib/hooks";
import { STATUS_META } from "../lib/status";
import { formatDuration, formatTime } from "../lib/time";
import { AgentAvatar, AvatarDefs } from "./AgentAvatar";
import { StatusIcon } from "./StatusIcon";

interface Props {
  agent: Agent | null;
  agents: Agent[];
  onClose: () => void;
  /** With a scrim that closes on click (default). The 3D office uses a non-modal drawer. */
  modal?: boolean;
}

/** Side drawer with everything about one agent. */
export function AgentDrawer({ agent, agents, onClose, modal = true }: Props) {
  const now = useNow(1000);
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    if (!agent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [agent, onClose]);

  const meta = agent ? STATUS_META[agent.status] : null;
  const waitingName =
    agent?.waitingOn === "human"
      ? "you"
      : (agents.find((a) => a.id === agent?.waitingOn)?.name ?? agent?.waitingOn);
  const activity = agent ? agent.activity.slice(-10).reverse() : [];

  return (
    <AnimatePresence>
      {agent && meta && (
        <>
          {modal && (
            <motion.button
              key="scrim"
              type="button"
              className="scrim"
              aria-label="Close details"
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          )}
          <motion.aside
            key="drawer"
            className="drawer"
            style={{ "--accent": agent.color } as CSSProperties}
            role="dialog"
            aria-label={`${agent.name} details`}
            initial={{ x: 440 }}
            animate={{ x: 0 }}
            exit={{ x: 440 }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
          >
            <div className="drawer-head">
              <svg
                className="drawer-avatar"
                viewBox="100 38 100 110"
                role="img"
                aria-label={`${agent.name} avatar`}
              >
                <title>{agent.name} avatar</title>
                <AvatarDefs gid={gid} color={agent.color} />
                <AgentAvatar agent={agent} gid={gid} part="body" />
              </svg>
              <div>
                <div className="drawer-name">{agent.name}</div>
                <div className="drawer-role">{agent.role}</div>
              </div>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
                <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true">
                  <path
                    d="M2 2l10 10M12 2 2 12"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div>
              <span className="pill" style={{ "--c": meta.color } as CSSProperties}>
                <StatusIcon status={agent.status} size={13} />
                {meta.label}
                <span className="mono">
                  for {formatDuration(now.getTime() - new Date(agent.statusSince).getTime())}
                </span>
              </span>
            </div>

            <section>
              <h3>Current task</h3>
              <div className="drawer-task">{agent.currentTask}</div>
              <p className="drawer-desc">{agent.taskDescription}</p>
              <div className="progress-row">
                <div className="bar">
                  <i style={{ width: `${agent.progress}%` }} />
                </div>
                <span className="mono bar-value">{agent.progress}%</span>
              </div>
            </section>

            <section>
              <h3>Subtasks</h3>
              {agent.subtasks.length === 0 ? (
                <div className="empty">No subtasks on this one.</div>
              ) : (
                <ul className="subtasks">
                  {agent.subtasks.map((s) => (
                    <li key={s.label} className={s.done ? "is-done" : ""}>
                      <span className={s.done ? "check check--done" : "check"} aria-hidden="true">
                        {s.done && (
                          <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden="true">
                            <path
                              d="m2 5 2 2 4-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.8}
                              strokeLinecap="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span>{s.label}</span>
                      <span className="sr-only">{s.done ? "done" : "to do"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {agent.status === "waiting" && (
              <section>
                <h3>Waiting on</h3>
                <div className="note" style={{ "--c": "#ffb020" } as CSSProperties}>
                  <b>{waitingName}</b>
                  {agent.waitingOn === "human"
                    ? " needs to weigh in before this can continue."
                    : " has to deliver first."}
                </div>
              </section>
            )}

            {agent.status === "blocked" && agent.blockedReason && (
              <section>
                <h3>Why it is blocked</h3>
                <div className="note" style={{ "--c": "#ff4545" } as CSSProperties}>
                  {agent.blockedReason}
                </div>
              </section>
            )}

            <section>
              <h3>Next up</h3>
              <div>{agent.nextUp}</div>
            </section>

            <section>
              <h3>Recent activity</h3>
              <ul className="drawer-activity">
                {activity.map((entry) => (
                  <li key={`${entry.time}-${entry.text}`}>
                    <span className="feed-time">{formatTime(entry.time)}</span>
                    <span>{entry.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
