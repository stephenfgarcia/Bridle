/**
 * The one data file. Everything the office shows comes from here (via `useAgents`),
 * so a live source can replace it later without touching the UI.
 */
import type { Agent, AgentStatus, HqSnapshot, Project } from "./types";

export interface TaskTemplate {
  task: string;
  description: string;
  subtasks: string[];
}

/** Tasks each role can pick up; demo mode draws new work from here. */
export const TASK_POOL: Record<string, TaskTemplate[]> = {
  Orchestrator: [
    {
      task: "Sequencing the launch-week handoffs",
      description:
        "Resolving the dependencies between copy, design and dev so the landing page ships before the social push starts.",
      subtasks: [
        "Confirm the copy freeze date",
        "Map the design to dev handoff",
        "Schedule the QA window",
        "Publish the launch runbook",
      ],
    },
    {
      task: "Reviewing milestone risk for week 3",
      description: "Checking every milestone owner's confidence and pulling slack where it exists.",
      subtasks: ["Collect owner confidence", "Flag slipping items", "Propose re-sequencing"],
    },
    {
      task: "Rebalancing work across the team",
      description:
        "Moving two subtasks off the critical path so the designer is not the bottleneck.",
      subtasks: ["List critical-path tasks", "Find idle capacity", "Reassign and notify"],
    },
    {
      task: "Drafting the Friday status update",
      description: "A one-page summary of progress, risks and asks for the stakeholders.",
      subtasks: ["Gather numbers", "Write the summary", "Collect asks", "Send for review"],
    },
  ],
  Researcher: [
    {
      task: "Competitor pricing teardown",
      description: "Tier-by-tier comparison of the three closest competitors' pricing pages.",
      subtasks: ["Capture pricing pages", "Normalise tiers", "Spot gaps", "Write the summary"],
    },
    {
      task: "Customer interview synthesis",
      description:
        "Clustering the themes from twelve customer interviews into launch messaging inputs.",
      subtasks: ["Tag transcripts", "Cluster themes", "Pull quotes", "Share findings"],
    },
    {
      task: "Keyword gap analysis for launch SEO",
      description:
        "Finding the search terms competitors rank for that the launch page should target.",
      subtasks: ["Export rankings", "Diff against ours", "Prioritise by intent"],
    },
    {
      task: "Audience persona refresh",
      description: "Updating the two primary personas with what the last quarter's data says.",
      subtasks: ["Review analytics", "Update pain points", "Circulate the draft"],
    },
  ],
  Copywriter: [
    {
      task: "Landing page hero copy, round 2",
      description: "Tightening the headline and sub-headline after the first review round.",
      subtasks: ["Rework headline options", "Rewrite the sub-head", "Align the CTA", "Proof"],
    },
    {
      task: "Launch email sequence (3 emails)",
      description: "Teaser, launch-day and follow-up emails with subject line variants.",
      subtasks: ["Teaser email", "Launch-day email", "Follow-up email", "Subject line variants"],
    },
    {
      task: "Press release draft",
      description: "A short release with a quote from the founder and the key launch facts.",
      subtasks: ["Outline", "Draft", "Founder quote", "Fact check"],
    },
    {
      task: "Ad copy variants for paid social",
      description: "Six short variants for the paid test, two per audience.",
      subtasks: ["Audience A variants", "Audience B variants", "Audience C variants"],
    },
  ],
  Designer: [
    {
      task: "Hero visual concepts",
      description: "Three directions for the landing page hero, one to be picked on Thursday.",
      subtasks: ["Mood board", "Direction A", "Direction B", "Direction C"],
    },
    {
      task: "Social template kit",
      description: "Reusable templates for Instagram, LinkedIn and X in the launch look.",
      subtasks: ["Instagram set", "LinkedIn set", "X set", "Export and hand off"],
    },
    {
      task: "Landing page component specs",
      description: "Spacing, type and state specs for every landing page component.",
      subtasks: ["Type scale", "Component states", "Responsive rules"],
    },
    {
      task: "Launch-day motion teaser",
      description: "A six-second motion teaser for the launch-day post.",
      subtasks: ["Storyboard", "Animate", "Render variants"],
    },
  ],
  Developer: [
    {
      task: "Landing page build in Next.js",
      description:
        "Building the launch landing page from the component specs, with the CMS wired in.",
      subtasks: ["Scaffold the route", "Build the hero", "Wire the CMS", "Deploy to staging"],
    },
    {
      task: "Email template HTML + dark-mode pass",
      description: "Hand-coded email template that survives Outlook and renders well in dark mode.",
      subtasks: ["Base template", "Dark-mode styles", "Client tests"],
    },
    {
      task: "Analytics events for the launch funnel",
      description: "Instrumenting the signup funnel so the analyst can see every step.",
      subtasks: ["Define events", "Instrument the page", "Verify in the dashboard"],
    },
    {
      task: "Signup form to CRM webhook",
      description: "Posting new signups to the CRM with retries and a dead-letter log.",
      subtasks: ["Webhook handler", "Retries", "Dead-letter log", "End-to-end test"],
    },
  ],
  "Social Media": [
    {
      task: "Two-week teaser calendar",
      description: "Day-by-day posts for the two weeks before launch, across three channels.",
      subtasks: ["Week 1 posts", "Week 2 posts", "Visual pairing", "Schedule"],
    },
    {
      task: "Launch-day post thread",
      description: "The announcement thread with the hook, the proof and the call to action.",
      subtasks: ["Hook", "Proof points", "CTA", "Schedule"],
    },
    {
      task: "Community reply macros",
      description: "Pre-approved replies for the questions we expect on launch day.",
      subtasks: ["Collect likely questions", "Draft replies", "Get approval"],
    },
    {
      task: "Influencer outreach shortlist",
      description: "Twenty creators who fit the audience, with a personalised first line each.",
      subtasks: ["Build the list", "Write first lines", "Send the first batch"],
    },
  ],
  "QA Tester": [
    {
      task: "Cross-browser pass on the landing page",
      description: "Checking the landing page in the five browsers that cover 97% of visits.",
      subtasks: ["Chrome", "Safari", "Firefox", "Mobile Safari", "Mobile Chrome"],
    },
    {
      task: "Email rendering checks",
      description: "Rendering the launch emails in Gmail, Outlook and Apple Mail, light and dark.",
      subtasks: ["Gmail", "Outlook", "Apple Mail", "Dark mode"],
    },
    {
      task: "Form submission edge cases",
      description: "Invalid input, double submits, slow networks and the CRM being down.",
      subtasks: ["Validation cases", "Double submit", "Slow network", "CRM down"],
    },
    {
      task: "Accessibility audit (WCAG AA)",
      description: "Keyboard, screen reader and contrast checks on the landing page.",
      subtasks: ["Keyboard pass", "Screen reader pass", "Contrast check"],
    },
  ],
  Analyst: [
    {
      task: "Launch KPI dashboard",
      description: "Signups, activation and spend in one view, refreshed hourly.",
      subtasks: ["Define metrics", "Build queries", "Lay out the dashboard", "Share"],
    },
    {
      task: "Budget pacing model",
      description: "Forecasting paid spend against the launch budget week by week.",
      subtasks: ["Pull spend to date", "Model the pacing", "Flag overruns"],
    },
    {
      task: "Attribution setup review",
      description: "Checking that every channel's traffic lands with the right UTM tags.",
      subtasks: ["Audit UTM tags", "Fix gaps", "Document the scheme"],
    },
    {
      task: "Weekly performance readout",
      description: "What moved, why, and what to do about it, in five bullets.",
      subtasks: ["Pull the numbers", "Write the bullets", "Review with Atlas"],
    },
  ],
};

export const BLOCK_REASONS = [
  "Staging deploy fails: the CMS API token is missing from the environment",
  "The brand asset library is locked for an audit",
  "Rate limited by the research API until the quota resets",
  "Two reviewers gave conflicting feedback on the brief",
  "The analytics workspace is in read-only maintenance",
];

export const WAITING_NEEDS = [
  "final assets",
  "a review",
  "the latest copy",
  "the brief",
  "sign-off",
];

const iso = (now: Date, minutesAgo: number): string =>
  new Date(now.getTime() - minutesAgo * 60_000).toISOString();

function template(role: string, index: number): TaskTemplate {
  const pool = TASK_POOL[role];
  const t = pool?.[index] ?? pool?.[0];
  if (!t) throw new Error(`No tasks for role ${role}`);
  return t;
}

interface SeedSpec {
  id: string;
  name: string;
  role: string;
  color: string;
  status: AgentStatus;
  taskIndex: number;
  progress: number;
  sinceMinutes: number;
  waitingOn?: string;
  blockedReason?: string;
  nextIndex: number;
  activity: { minutesAgo: number; text: string; kind?: "done" | "start" | "status" | "note" }[];
}

const SEED: SeedSpec[] = [
  {
    id: "atlas",
    name: "Atlas",
    role: "Orchestrator",
    color: "#FF2BD6",
    status: "working",
    taskIndex: 0,
    progress: 58,
    sinceMinutes: 14,
    nextIndex: 3,
    activity: [
      { minutesAgo: 512, text: "Atlas finished the week 2 plan", kind: "done" },
      { minutesAgo: 410, text: "Atlas re-sequenced the creative milestone", kind: "note" },
      { minutesAgo: 287, text: "Atlas finished the design to dev handoff plan", kind: "done" },
      {
        minutesAgo: 95,
        text: "Atlas picked up sequencing the launch-week handoffs",
        kind: "start",
      },
      { minutesAgo: 14, text: 'Atlas checked off "Map the design to dev handoff"', kind: "note" },
    ],
  },
  {
    id: "nova",
    name: "Nova",
    role: "Researcher",
    color: "#8B5CF6",
    status: "done",
    taskIndex: 0,
    progress: 100,
    sinceMinutes: 6,
    nextIndex: 2,
    activity: [
      { minutesAgo: 470, text: "Nova finished the customer interview synthesis", kind: "done" },
      { minutesAgo: 230, text: "Nova picked up the competitor pricing teardown", kind: "start" },
      { minutesAgo: 120, text: "Nova shared a draft of the pricing teardown", kind: "note" },
      { minutesAgo: 6, text: "Nova finished the competitor pricing teardown", kind: "done" },
    ],
  },
  {
    id: "quill",
    name: "Quill",
    role: "Copywriter",
    color: "#19F5A1",
    status: "working",
    taskIndex: 0,
    progress: 72,
    sinceMinutes: 31,
    nextIndex: 1,
    activity: [
      { minutesAgo: 380, text: "Quill finished the landing page hero copy, round 1", kind: "done" },
      {
        minutesAgo: 330,
        text: "Quill is waiting on Nova for the pricing research",
        kind: "status",
      },
      { minutesAgo: 60, text: "Quill picked up the hero copy, round 2", kind: "start" },
      { minutesAgo: 31, text: 'Quill checked off "Rework headline options"', kind: "note" },
    ],
  },
  {
    id: "pixel",
    name: "Pixel",
    role: "Designer",
    color: "#F472B6",
    status: "thinking",
    taskIndex: 0,
    progress: 35,
    sinceMinutes: 4,
    nextIndex: 1,
    activity: [
      { minutesAgo: 540, text: "Pixel finished the mood board", kind: "done" },
      { minutesAgo: 150, text: "Pixel picked up the hero visual concepts", kind: "start" },
      { minutesAgo: 40, text: 'Pixel checked off "Direction A"', kind: "note" },
      { minutesAgo: 4, text: "Pixel is thinking through direction B", kind: "status" },
    ],
  },
  {
    id: "byte",
    name: "Byte",
    role: "Developer",
    color: "#22D3EE",
    status: "blocked",
    taskIndex: 0,
    progress: 44,
    sinceMinutes: 9,
    blockedReason: BLOCK_REASONS[0],
    nextIndex: 2,
    activity: [
      { minutesAgo: 600, text: "Byte finished the signup form to CRM webhook", kind: "done" },
      { minutesAgo: 200, text: "Byte picked up the landing page build", kind: "start" },
      { minutesAgo: 70, text: 'Byte checked off "Build the hero"', kind: "note" },
      { minutesAgo: 9, text: "Byte hit a blocker: the staging deploy fails", kind: "status" },
    ],
  },
  {
    id: "echo",
    name: "Echo",
    role: "Social Media",
    color: "#FB923C",
    status: "waiting",
    taskIndex: 0,
    progress: 60,
    sinceMinutes: 17,
    waitingOn: "pixel",
    nextIndex: 1,
    activity: [
      { minutesAgo: 455, text: "Echo finished the community reply macros", kind: "done" },
      { minutesAgo: 180, text: "Echo picked up the two-week teaser calendar", kind: "start" },
      {
        minutesAgo: 17,
        text: "Echo is waiting on Pixel for the social template kit",
        kind: "status",
      },
    ],
  },
  {
    id: "sentinel",
    name: "Sentinel",
    role: "QA Tester",
    color: "#FDE047",
    status: "waiting",
    taskIndex: 0,
    progress: 20,
    sinceMinutes: 22,
    waitingOn: "human",
    nextIndex: 1,
    activity: [
      { minutesAgo: 350, text: "Sentinel finished the form submission edge cases", kind: "done" },
      { minutesAgo: 110, text: "Sentinel picked up the cross-browser pass", kind: "start" },
      { minutesAgo: 22, text: "Sentinel is waiting on you for staging access", kind: "status" },
    ],
  },
  {
    id: "ledger",
    name: "Ledger",
    role: "Analyst",
    color: "#60A5FA",
    status: "idle",
    taskIndex: 0,
    progress: 0,
    sinceMinutes: 12,
    nextIndex: 1,
    activity: [
      { minutesAgo: 300, text: "Ledger finished the attribution setup review", kind: "done" },
      { minutesAgo: 90, text: "Ledger finished the launch KPI dashboard", kind: "done" },
      { minutesAgo: 12, text: "Ledger is idle, waiting for the next assignment", kind: "status" },
    ],
  },
];

function seedAgent(spec: SeedSpec, now: Date): Agent {
  const t = template(spec.role, spec.taskIndex);
  const next = template(spec.role, spec.nextIndex);
  const idle = spec.status === "idle";
  const doneCount = Math.round((spec.progress / 100) * t.subtasks.length);
  return {
    id: spec.id,
    name: spec.name,
    role: spec.role,
    color: spec.color,
    status: spec.status,
    currentTask: idle ? "Between tasks" : t.task,
    taskDescription: idle ? "Waiting for Atlas to assign the next piece of work." : t.description,
    progress: spec.progress,
    subtasks: idle
      ? []
      : t.subtasks.map((label, i) => ({ label, done: i < doneCount || spec.progress >= 100 })),
    waitingOn: spec.waitingOn,
    blockedReason: spec.blockedReason,
    nextUp: next.task,
    statusSince: iso(now, spec.sinceMinutes),
    activity: spec.activity.map((a) => ({
      time: iso(now, a.minutesAgo),
      text: a.text,
      kind: a.kind,
    })),
  };
}

function seedProject(): Project {
  return {
    name: "Q4 Launch Campaign",
    deadline: "2026-12-10",
    milestones: [
      { name: "Research & positioning", status: "done", due: "2026-10-17" },
      { name: "Messaging & copy", status: "done", due: "2026-10-31" },
      { name: "Creative & landing page", status: "in-progress", due: "2026-11-14" },
      { name: "Social & PR rollout", status: "upcoming", due: "2026-11-28" },
      { name: "Launch & reporting", status: "upcoming", due: "2026-12-10" },
    ],
  };
}

/** The sample office, with activity timestamps relative to `now`. */
export function createSeed(now: Date = new Date()): HqSnapshot {
  return { project: seedProject(), agents: SEED.map((s) => seedAgent(s, now)) };
}
