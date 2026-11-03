import { AnimatePresence, motion } from "motion/react";
import { type CSSProperties, useId } from "react";
import type { Agent, Project } from "../data/types";
import {
  completedByHour,
  completedToday,
  type HourBucket,
  mergedFeed,
  overallProgress,
  statusCounts,
} from "../lib/derive";
import { useNow } from "../lib/hooks";
import { STATUS_META, STATUS_ORDER } from "../lib/status";
import { daysUntil, formatDate, formatTime } from "../lib/time";
import { StatusIcon } from "./StatusIcon";

interface Props {
  project: Project;
  agents: Agent[];
}

const MINI_SCREENS = [
  { id: "m1", c: "#ff2bd6", bars: [40, 70, 55, 90] },
  { id: "m2", c: "#8b5cf6", bars: [80, 50, 65, 30] },
  { id: "m3", c: "#19f5a1", bars: [30, 60, 90, 70] },
  { id: "m4", c: "#ff2bd6", bars: [60, 40, 80, 50] },
  { id: "m5", c: "#8b5cf6", bars: [90, 70, 40, 60] },
  { id: "m6", c: "#19f5a1", bars: [50, 85, 35, 75] },
  { id: "m7", c: "#ff2bd6", bars: [70, 30, 60, 90] },
  { id: "m8", c: "#8b5cf6", bars: [45, 65, 85, 40] },
  { id: "m9", c: "#19f5a1", bars: [85, 45, 70, 55] },
  { id: "m10", c: "#ff2bd6", bars: [35, 75, 50, 80] },
  { id: "m11", c: "#8b5cf6", bars: [65, 90, 45, 60] },
  { id: "m12", c: "#19f5a1", bars: [55, 35, 80, 70] },
  { id: "m13", c: "#ff2bd6", bars: [75, 55, 30, 85] },
  { id: "m14", c: "#8b5cf6", bars: [40, 80, 65, 50] },
];

const EDGE_SCREENS = ["e1", "e2", "e3"];
const BAR_IDS = ["b1", "b2", "b3", "b4"];

function Gauge({ value }: { value: number }) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const size = 150;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const visible = c * 0.75;
  const offset = visible * (1 - value / 100);
  return (
    <svg
      className="gauge"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Overall progress ${value}%`}
    >
      <title>Overall progress {value}%</title>
      <defs>
        <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff2bd6" />
          <stop offset="0.5" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#19f5a1" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${visible} ${c}`}
        transform={`rotate(135 ${size / 2} ${size / 2})`}
      />
      <circle
        className="gauge-fill"
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={`url(#${gid}-g)`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${visible} ${c}`}
        strokeDashoffset={offset}
        transform={`rotate(135 ${size / 2} ${size / 2})`}
      />
      <text className="gauge-value" x="50%" y="48%" textAnchor="middle" dominantBaseline="central">
        {value}%
      </text>
      <text className="gauge-label" x="50%" y="72%" textAnchor="middle">
        OVERALL
      </text>
    </svg>
  );
}

function CompletedChart({ buckets }: { buckets: HourBucket[] }) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const w = 360;
  const h = 72;
  const pad = 3;
  const bw = w / buckets.length;
  const bh = 52;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      role="img"
      aria-label="Tasks completed per hour, last twelve hours"
    >
      <title>Tasks completed per hour, last twelve hours</title>
      <defs>
        <linearGradient id={`${gid}-bar`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#19f5a1" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {buckets.map((b, i) => {
        const x = i * bw + pad;
        const scale = Math.max(0.04, b.count / max);
        return (
          <g key={b.hour}>
            <rect
              className="chart-bar"
              x={x}
              y={h - 16 - bh}
              width={bw - pad * 2}
              height={bh}
              rx={2}
              fill={`url(#${gid}-bar)`}
              style={{ transform: `scaleY(${scale})` }}
              opacity={b.count === 0 ? 0.35 : 0.95}
            />
            <text className="chart-axis" x={x + (bw - pad * 2) / 2} y={h - 4} textAnchor="middle">
              {b.hour.toString().padStart(2, "0")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface PanelProps {
  agents: Agent[];
  className?: string;
}

/** Newest-first activity feed. */
export function FeedPanel({ agents, className = "panel" }: PanelProps) {
  const feed = mergedFeed(agents, 7);
  return (
    <section className={className} aria-label="Activity feed">
      <h3>Activity</h3>
      <ul className="feed">
        <AnimatePresence initial={false}>
          {feed.map((item) => (
            <motion.li
              key={item.key}
              layout
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <span className="feed-time">{formatTime(item.time)}</span>
              <span className="feed-dot" style={{ "--c": item.color } as CSSProperties} />
              <span className={item.kind === "done" ? "feed-text feed-text--done" : "feed-text"}>
                {item.text}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

/** Project name, overall gauge, headline numbers and the milestone timeline. */
export function OverviewPanel({
  project,
  agents,
  className = "panel",
}: Props & { className?: string }) {
  const now = useNow(30_000);
  const overall = overallProgress(agents);
  const counts = statusCounts(agents);
  const doneToday = completedToday(agents, now);
  const daysLeft = daysUntil(project.deadline, now);
  const doneMilestones = project.milestones.filter((m) => m.status === "done").length;
  return (
    <section className={className} aria-label="Project overview">
      <header className="project-head">
        <h2 className="project-name">{project.name}</h2>
        <span className="deadline">
          Deadline <b>{formatDate(project.deadline)}</b> · {daysLeft} days
        </span>
      </header>
      <div className="gauge-row">
        <Gauge value={overall} />
        <div className="gauge-side">
          <div className="stat">
            <span>Agents</span>
            <b>{agents.length}</b>
          </div>
          <div className="stat">
            <span>Working now</span>
            <b>{counts.working}</b>
          </div>
          <div className="stat">
            <span>Needs attention</span>
            <b>{counts.blocked + counts.waiting}</b>
          </div>
          <div className="stat">
            <span>Milestones</span>
            <b>
              {doneMilestones}/{project.milestones.length}
            </b>
          </div>
          <div className="stat">
            <span>Completed today</span>
            <b>{doneToday}</b>
          </div>
        </div>
      </div>
      <ol className="milestones">
        {project.milestones.map((m) => (
          <li key={m.name} className={`ms ms--${m.status}`}>
            <div className="ms-node" aria-hidden="true">
              {m.status === "done" && (
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
            </div>
            <div className="ms-name">{m.name}</div>
            <div className="ms-due">
              {m.status === "done" ? "done" : m.status === "in-progress" ? "now" : "due"} ·{" "}
              {formatDate(m.due)}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Agents per status and the tasks-completed chart. */
export function StatsPanel({ agents, className = "panel" }: PanelProps) {
  const now = useNow(30_000);
  const counts = statusCounts(agents);
  const buckets = completedByHour(agents, now, 12);
  const doneToday = completedToday(agents, now);
  return (
    <section className={className} aria-label="Agent status">
      <h3>Agents by status</h3>
      <ul className="counts">
        {STATUS_ORDER.map((s) => {
          const meta = STATUS_META[s];
          const pct = agents.length ? (counts[s] / agents.length) * 100 : 0;
          return (
            <li key={s} style={{ "--c": meta.color, color: meta.color } as CSSProperties}>
              <StatusIcon status={s} size={14} />
              <span className="count-label">{meta.label}</span>
              <span className="count-bar">
                <i style={{ width: `${pct}%` }} />
              </span>
              <span className="count-num">{counts[s]}</span>
            </li>
          );
        })}
      </ul>
      <div className="chart-head">
        <h3>Tasks completed today</h3>
        <span className="chart-total">{doneToday}</span>
      </div>
      <CompletedChart buckets={buckets} />
    </section>
  );
}

/** The curved wall of screens in the 2D office: feed left, overview centre, stats right. */
export function ScreenWall({ project, agents }: Props) {
  return (
    <div className="wall">
      <div className="wall-strip" aria-hidden="true">
        {MINI_SCREENS.map((m, i) => (
          <div
            key={m.id}
            className="mini"
            style={{ "--c": m.c, animationDelay: `${-i * 0.9}s` } as CSSProperties}
          >
            {BAR_IDS.map((id, j) => (
              <i key={id} style={{ height: `${m.bars[j] ?? 50}%` }} />
            ))}
          </div>
        ))}
      </div>
      <div className="wall-edge wall-edge--left" aria-hidden="true">
        {EDGE_SCREENS.map((id) => (
          <div key={id} className="edge-screen" />
        ))}
      </div>

      <div className="wall-panels">
        <FeedPanel agents={agents} className="panel panel--left" />
        <OverviewPanel project={project} agents={agents} className="panel panel--center" />
        <StatsPanel agents={agents} className="panel panel--right" />
      </div>
    </div>
  );
}
