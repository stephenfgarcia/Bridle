/**
 * Seeds Supabase with the sample project and agents from src/data/agents.ts.
 *   pnpm seed            upserts the project and agents; adds activity only for agents without any
 *   pnpm seed --reset    also wipes and re-inserts every agent's activity
 */
import { createClient } from "@supabase/supabase-js";
import { createSeed } from "../src/data/agents.ts";
import { rowFromAgent } from "../src/data/live/rows.ts";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PROJECT_ID = process.env.VITE_PROJECT_ID ?? "q4-launch";
const reset = process.argv.includes("--reset");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fail = (step: string, message: string): never => {
  console.error(`${step}: ${message}`);
  process.exit(1);
};

const seed = createSeed(new Date());

const { error: projectError } = await supabase.from("projects").upsert({
  id: PROJECT_ID,
  name: seed.project.name,
  deadline: seed.project.deadline,
  milestones: seed.project.milestones,
});
if (projectError) fail("projects", projectError.message);

const rows = seed.agents.map((agent, i) => rowFromAgent(agent, PROJECT_ID, i));
const { error: agentsError } = await supabase.from("agents").upsert(rows);
if (agentsError) fail("agents", agentsError.message);

const ids = rows.map((r) => r.id);
if (reset) {
  const { error } = await supabase.from("agent_activity").delete().in("agent_id", ids);
  if (error) fail("agent_activity delete", error.message);
}

const { data: existing, error: existingError } = await supabase
  .from("agent_activity")
  .select("agent_id")
  .in("agent_id", ids);
if (existingError) fail("agent_activity read", existingError.message);
const haveActivity = new Set((existing ?? []).map((r) => (r as { agent_id: string }).agent_id));

const inserts = seed.agents
  .filter((agent) => !haveActivity.has(agent.id))
  .flatMap((agent) =>
    agent.activity.map((entry) => ({
      agent_id: agent.id,
      time: entry.time,
      text: entry.text,
      kind: entry.kind ?? null,
    })),
  );
if (inserts.length > 0) {
  const { error } = await supabase.from("agent_activity").insert(inserts);
  if (error) fail("agent_activity insert", error.message);
}

console.log(
  `seeded project "${seed.project.name}" (${PROJECT_ID}), ${rows.length} agents, ${inserts.length} activity rows`,
);
