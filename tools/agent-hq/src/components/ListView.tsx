import { type CSSProperties, useId } from "react";
import type { Agent } from "../data/types";
import { STATUS_META } from "../lib/status";
import { AgentAvatar, AvatarDefs } from "./AgentAvatar";
import { StatusIcon } from "./StatusIcon";

interface Props {
  agents: Agent[];
  onSelect: (id: string) => void;
}

interface CardProps {
  agent: Agent;
  agents: Agent[];
  onSelect: (id: string) => void;
}

function AgentCard({ agent, agents, onSelect }: CardProps) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const meta = STATUS_META[agent.status];
  const waitingName =
    agent.waitingOn === "human"
      ? "you"
      : (agents.find((a) => a.id === agent.waitingOn)?.name ?? agent.waitingOn);
  return (
    <button
      type="button"
      className="card"
      style={{ "--accent": agent.color } as CSSProperties}
      onClick={() => onSelect(agent.id)}
    >
      <svg
        className="card-avatar"
        viewBox="92 36 116 170"
        role="img"
        aria-label={`${agent.name} avatar`}
      >
        <title>{agent.name} avatar</title>
        <AvatarDefs gid={gid} color={agent.color} />
        <AgentAvatar agent={agent} gid={gid} part="all" />
      </svg>
      <div className="card-body">
        <div>
          <span className="card-name">{agent.name}</span>
          <span className="card-role">{agent.role}</span>
        </div>
        <span className="pill" style={{ "--c": meta.color } as CSSProperties}>
          <StatusIcon status={agent.status} size={12} />
          {meta.label}
        </span>
        <div className="card-task" title={agent.currentTask}>
          {agent.currentTask}
        </div>
        <div className="progress-row">
          <div className="bar">
            <i style={{ width: `${agent.progress}%` }} />
          </div>
          <span className="mono bar-value">{agent.progress}%</span>
        </div>
        {agent.status === "waiting" && <div className="card-meta">Waiting on {waitingName}</div>}
        {agent.status === "blocked" && agent.blockedReason && (
          <div className="card-meta">{agent.blockedReason}</div>
        )}
      </div>
    </button>
  );
}

/** The same agents as a grid of neon cards; the default on phones. */
export function ListView({ agents, onSelect }: Props) {
  return (
    <div className="list">
      <div className="cards">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} agents={agents} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
