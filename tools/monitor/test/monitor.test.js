// Headless test of the Bridle Build Monitor derivation logic. Run: node tools/monitor/test/monitor.test.js
// The page's script runs in a bare vm context (no document, no JSON, no timers); only the pure part above the
// document guard is exercised, through globalThis.BridleMonitor.
const vm = require('vm');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const src = html.slice(html.indexOf('<script>\n') + 9, html.lastIndexOf('\n</script>'));
const ctx = { console, Date, Map, Set, Array, Object, Number, String, Math, isFinite, Infinity, globalThis: {} };
ctx.globalThis = ctx;
vm.runInNewContext(src, ctx);
const M = ctx.BridleMonitor;
if (!M) throw new Error('BridleMonitor not exposed');
const assert = (c, m) => { if (!c) throw new Error('ASSERT ' + m); };
const add = (e, source) => { const n = M.normEvent(e, e.id, source || 'db'); if (!n) throw new Error('norm failed ' + e.id); M.state.events.set(n.id, n); M.touch(); return n; };
const reset = () => { M.state.events.clear(); M.touch(); M.state.selectedRun = 'all'; M.state.selectedTask = null; M.state.selectedAgent = null; };
const evAt = (ms, o) => add(Object.assign({ id: `${ms}-${o.agentId}-${String(o.seq || 1).padStart(4, '0')}`, ts: new Date(ms).toISOString(), tsMs: ms, runId: 'factory', phase: 'P0', taskId: 'P0-10' }, o));

// ---- original derivation tests (status, stale, run filter, precedence, malformed input) ----
const base = Date.now() - 60_000;
const mk = (i, o) => Object.assign({ id: `${base + i * 1000}-${o.agentId || 'orch'}-${String(i).padStart(4, '0')}`, ts: new Date(base + i * 1000).toISOString(), tsMs: base + i * 1000, seq: i, runId: 'wf_test', phase: 'PLAN' }, o);
const events = [
  mk(1, { type: 'run.start', message: 'requirements workflow' }),
  mk(2, { type: 'task.status', taskId: 'PLAN-01', status: 'running' }),
  mk(3, { type: 'agent.start', agentId: 'req-structural', taskId: 'PLAN-01', message: 'starting' }),
  mk(4, { type: 'agent.progress', agentId: 'req-structural', taskId: 'PLAN-01', progress: 40, step: 'codes' }),
  mk(5, { type: 'agent.start', agentId: 'req-fea', taskId: 'PLAN-01', message: 'starting' }),
  mk(6, { type: 'agent.log', agentId: 'req-fea', taskId: 'PLAN-01', level: 'error', message: 'web search failed' }),
  mk(7, { type: 'agent.done', agentId: 'req-structural', taskId: 'PLAN-01', message: 'finished 32 reqs' }),
  mk(8, { type: 'agent.start', agentId: 'arch-a', taskId: 'PLAN-02', message: 'proposal A' }),
  mk(9, { type: 'agent.fail', agentId: 'arch-a', taskId: 'PLAN-02', message: 'crashed' }),
  { id: 'weird', type: 'agent.heartbeat', agentId: 'old-agent', taskId: 'P2-00', runId: 'wf_old', ts: new Date(base - 20 * 60_000).toISOString() },
];
for (const e of events) add(e);
const d = M.derive(Date.now());
const t = Object.fromEntries(d.tasks.map(t => [t.id, t]));
const a = Object.fromEntries(d.agents.map(a => [a.id, a]));
assert(d.runs.size === 2, 'two runs');
assert(d.runs.get('wf_test').name === 'requirements workflow', 'run name');
assert(a['req-structural'].status === 'done' && a['req-structural'].progress === 100, 'structural done');
assert(a['req-fea'].status === 'running' && a['req-fea'].errors === 1 && a['req-fea'].display === 'running', 'fea running with 1 error');
assert(a['arch-a'].status === 'failed', 'arch-a failed');
assert(a['old-agent'].display === 'stale', 'old heartbeat is stale');
assert(t['PLAN-01'].status === 'running' && t['PLAN-01'].progress === 50, 'PLAN-01 running at 50 (mean of 100 and 0): ' + t['PLAN-01'].status + ' ' + t['PLAN-01'].progress);
assert(t['PLAN-02'].status === 'failed', 'PLAN-02 failed');
assert(t['P2-00'].status === 'running', 'P2-00 running (stale agent still counts as running)');
assert(t['PLAN-03'].status === 'planned', 'PLAN-03 planned');
const expectTasks = new Set([...M.SEED_TASKS.map(x => x.id), 'PLAN-01', 'PLAN-02', 'P2-00']).size;
assert(d.totals.tasks === expectTasks, 'task count ' + d.totals.tasks + ' vs ' + expectTasks);
assert(M.SEED_TASKS.length >= 50 && !M.SEED_TASKS.some(x => x.placeholder), 'seed tasks come from the cards, no placeholders left');
assert(d.totals.stale === 1 && d.totals.failed === 1 && d.totals.running === 1 && d.totals.doneAgents === 1, 'totals ' + JSON.stringify(d.totals));
assert(d.current && d.current.id === 'PLAN', 'current phase PLAN');
assert(d.rate.length === 30 && d.rate.reduce((s, n) => s + n, 0) === 10 && d.rate[29] === 9 && d.rate[8] === 1, 'rate buckets count the last 30 min (9 just now, the old heartbeat 21 min ago): ' + JSON.stringify(d.rate));
assert(d.working.length === 2 && d.working[0].id === 'old-agent' && d.working[1].id === 'req-fea', 'working: stale and running, by start time');
assert(d.lastFinished && d.lastFinished.id === 'arch-a', 'last finished agent (by end time)');
assert(d.syncLagMs === null, 'no live db arrivals → no lag figure');
// run filter
M.state.selectedRun = 'wf_old';
const d2 = M.derive(Date.now());
assert(d2.agents.length === 1 && d2.agents[0].id === 'old-agent', 'run filter');
assert(d2.agentsAll.length === 4, 'agentsAll ignores the run filter');
M.state.selectedRun = 'nope';
assert(M.derive(Date.now()).runFilter === 'all', 'unknown run falls back to all');
// explicit later task.status wins over agents
M.state.selectedRun = 'all';
add(mk(50, { type: 'task.status', taskId: 'PLAN-02', status: 'review', progress: 90, message: 'needs instructor eyes' }));
const d3 = M.derive(Date.now());
assert(d3.tasks.find(t => t.id === 'PLAN-02').status === 'review', 'later task.status wins');
// malformed
assert(M.normEvent(null) === null && M.normEvent({}) === null, 'malformed rejected');
const n2 = M.normEvent({ type: 'agent.log', progress: '250', level: 'LOUD' }, 'x1', 'file');
assert(n2.progress === 100 && n2.level === 'info' && n2.source === 'file', 'clamping and defaults');
console.log('ALL TESTS PASSED', { tasks: d.totals.tasks, agents: d.agents.length, events: d.all.length });

// ---- factory derivation ----
{
  const base2 = Date.now() - 30_000;
  const mv = (i, taskId, station, status, agent) => ({ id: `${base2 + i * 1000}-${agent}-${String(i).padStart(4,'0')}`, ts: new Date(base2 + i * 1000).toISOString(), tsMs: base2 + i * 1000, seq: i, runId: 'factory', phase: 'P0', taskId, agentId: agent, type: 'card.move', step: station, status, progress: Math.round(M.STATIONS.indexOf(station) / 6 * 100), message: 'move' });
  for (const e of [mv(1, 'P0-04', 'spec', 'running', 'orchestrator'), mv(2, 'P0-04', 'plan', 'running', 'factory-planner'), mv(3, 'P0-04', 'build', 'running', 'factory-builder'),
                   mv(4, 'P0-03', 'ship', 'done', 'orchestrator')]) add(e);
  add(mk(59, { type: 'task.status', taskId: 'P0-01', status: 'done' }));
  M.state.selectedRun = 'all';
  const d4 = M.derive(Date.now());
  const c = Object.fromEntries(d4.cards.map(c => [c.task.id, c]));
  assert(c['P0-04'].station === 'build' && c['P0-04'].idx === 3 && c['P0-04'].history.length === 3, 'P0-04 at build with 3 history entries');
  assert(c['P0-04'].task.status === 'running' && c['P0-04'].task.progress === 50, 'card.move sets task status/progress: ' + c['P0-04'].task.status + ' ' + c['P0-04'].task.progress);
  assert(c['P0-03'].station === 'ship' && c['P0-03'].task.status === 'done', 'P0-03 shipped');
  assert(!d4.agents.some(a => a.id === 'factory-planner' || a.id === 'factory-builder'), 'card.move events never create agent cards');
  assert(c['P0-01'].station === 'ship', 'done task without moves sits at ship');
  assert(c['PLAN-03'].station === 'backlog' && c['PLAN-03'].idx === 0, 'untouched task in backlog');
  assert(d4.nextUp === null, 'nothing unblocked while PLAN-01 running and P0-04 in progress: ' + (d4.nextUp && d4.nextUp.task.id));
  add(mk(60, { type: 'task.status', taskId: 'PLAN-01', status: 'done' }));
  const d5 = M.derive(Date.now());
  assert(d5.nextUp && d5.nextUp.task.id === 'PLAN-03', 'next up is PLAN-03 (PLAN-02 is in review, so not eligible), got ' + (d5.nextUp && d5.nextUp.task.id));
  assert(!d5.cards.some(x => x.task.placeholder && d5.nextUp && d5.nextUp.task.id === x.task.id), 'placeholders never next up');
  console.log('FACTORY TESTS PASSED', { cards: d5.cards.length, nextUp: d5.nextUp.task.id });
}

// ---- activity events, steps, liveness ----
{
  reset();
  const t0 = Date.now() - 120_000;
  evAt(t0, { agentId: 'P0-10-build', seq: 1, type: 'agent.start', message: 'go' });
  evAt(t0 + 1000, { agentId: 'P0-10-build', seq: 2, type: 'agent.progress', progress: 40, step: 'a', message: 'did a', data: { stepIndex: 2, stepCount: 7 } });
  const act = evAt(t0 + 11000, { agentId: 'P0-10-build', seq: 3, type: 'agent.activity', message: 'Edit x; Bash y', data: { calls: 3, tools: { Edit: 1, Bash: 2 }, files: ['x'], last: { tool: 'Bash', target: 'y', tsMs: t0 + 10500 } } });
  assert(act.level === 'debug' && act.stepIndex === undefined && act.ephemeral === false, 'activity defaults to debug level');
  let d = M.derive(Date.now()); let a = d.agents.find(x => x.id === 'P0-10-build');
  assert(a.lastMessage === 'did a' && a.lastActivity.message === 'Edit x; Bash y' && a.lastAction === 'Edit x; Bash y' && a.lastActionKind === 'activity', 'activity is the last action');
  assert(a.lastTs === t0 + 11000 && a.activityCount === 1 && a.count === 2 && a.progress === 40 && a.step === 'a', 'activity updates liveness, never message/progress/step/count');
  assert(a.lastActivity.calls === 3 && a.lastActivity.tools.Bash === 2 && a.lastActivity.files[0] === 'x', 'activity payload kept');
  assert(a.stepIndex === 2 && a.stepCount === 7 && a.stepStartedTs === t0 + 1000, 'step index/count lifted; step start recorded');
  assert(a.activityTicks.length === 1 && a.activityTicks[0] === t0 + 11000, 'one activity tick');
  evAt(t0 + 21000, { agentId: 'P0-10-build', seq: 4, type: 'agent.progress', progress: 60, step: 'b', message: 'did b' });
  d = M.derive(Date.now()); a = d.agents.find(x => x.id === 'P0-10-build');
  assert(a.lastAction === 'did b' && a.lastActionKind === 'message', 'a later message beats an older activity');
  assert(a.stepIndex === undefined && a.stepCount === 7, 'stepIndex is not sticky across steps, stepCount is');
  assert(a.steps.length === 2 && a.steps[0].step === 'a' && a.steps[0].startTs === t0 + 1000 && a.steps[0].endTs === t0 + 21000 && a.steps[1].endTs === null && a.steps[1].step === 'b', 'step segments: ' + JSON.stringify(a.steps));
  evAt(t0 + 22000, { agentId: 'P0-10-build', seq: 5, type: 'agent.progress', progress: 65, step: 'b', message: 'still b', data: { stepIndex: 3 } });
  d = M.derive(Date.now()); a = d.agents.find(x => x.id === 'P0-10-build');
  assert(a.steps.length === 2 && a.stepIndex === 3 && a.stepStartedTs === t0 + 21000, 'same step: no new segment, index updates');
  evAt(t0 + 30000, { agentId: 'P0-10-build', seq: 6, type: 'agent.done', message: 'done' });
  evAt(t0 + 31000, { agentId: 'P0-10-build', seq: 7, type: 'agent.activity', message: 'Read z', data: { calls: 1 } });
  d = M.derive(Date.now()); a = d.agents.find(x => x.id === 'P0-10-build');
  assert(a.status === 'done' && a.display === 'done' && a.progress === 100 && a.steps[1].endTs === t0 + 30000, 'activity after done does not revive; the open step closes at done');
  const old = Date.now() - 15 * 60_000;
  evAt(old, { agentId: 'P0-10-test', seq: 1, type: 'agent.start', message: 'go' });
  evAt(Date.now() - 2 * 60_000, { agentId: 'P0-10-test', seq: 2, type: 'agent.activity', message: 'Bash node t', data: { calls: 4 } });
  d = M.derive(Date.now()); a = d.agents.find(x => x.id === 'P0-10-test');
  assert(a.display === 'running' && a.quietMs >= 119_000 && a.quietMs <= 121_000, 'recent tool calls keep a quiet agent alive: ' + a.display + ' ' + a.quietMs);
  evAt(Date.now() - 1000, { agentId: 'P0-10-test', seq: 3, type: 'agent.activity', message: 'Read q', data: { ephemeral: true, calls: 1 } });
  d = M.derive(Date.now()); a = d.agents.find(x => x.id === 'P0-10-test');
  assert(a.activityCount === 1 && a.activityTicks.length === 2 && a.lastAction === 'Read q' && a.lastActivity.ephemeral === true, 'ephemeral activity: tick and last action, no burst count');
  assert(d.working.length === 1 && d.working[0].id === 'P0-10-test' && d.lastFinished.id === 'P0-10-build', 'working and lastFinished');
  assert(d.evs.filter(M.isFeedEvent).length === 6, 'feed excludes activity: ' + d.evs.filter(M.isFeedEvent).length);
  const n = M.normEvent({ type: 'agent.activity', agentId: 'a', tsMs: 1, data: { stepIndex: '3', stepCount: '7' } }, 'x', 'db');
  assert(n.level === 'debug' && n.stepIndex === 3 && n.stepCount === 7 && n.ephemeral === false, 'normEvent lifts numeric strings');
  const n3 = M.normEvent({ type: 'agent.progress', tsMs: 1, data: { stepIndex: 'x', stepCount: 0, ephemeral: true } }, 'y', 'local');
  assert(n3.stepIndex === undefined && n3.stepCount === undefined && n3.level === 'info' && n3.ephemeral === true, 'bad step numbers ignored; ephemeral lifted');
  console.log('ACTIVITY TESTS PASSED');
}

// ---- an automatic done (SubagentStop hook) is provisional ----
{
  reset();
  const t0 = Date.now() - 300_000;
  evAt(t0, { agentId: 'P0-02.1-test', seq: 1, type: 'agent.start', message: 'go' });
  evAt(t0 + 10000, { agentId: 'P0-02.1-test', seq: 2, type: 'agent.heartbeat', message: 'test running in the background' });
  evAt(t0 + 15000, { agentId: 'P0-02.1-test', seq: 3, type: 'agent.done', message: 'waiting for the run', progress: 100, data: { auto: true, source: 'SubagentStop hook' } });
  let d = M.derive(Date.now()); let a = d.agents.find(x => x.id === 'P0-02.1-test');
  assert(a.status === 'done' && a.autoDone === true && a.progress === 100, 'an automatic done counts as done until the agent reports again');
  evAt(t0 + 23000, { agentId: 'P0-02.1-test', seq: 4, type: 'agent.activity', message: 'folded trace', data: { calls: 1, untilTsMs: t0 + 10500 } });
  d = M.derive(Date.now()); a = d.agents.find(x => x.id === 'P0-02.1-test');
  assert(a.status === 'done', 'a folded trace whose calls predate the done does not revive');
  evAt(t0 + 60000, { agentId: 'P0-02.1-test', seq: 5, type: 'agent.progress', progress: 80, step: 'record', message: 'test finished, writing ## Test' });
  d = M.derive(Date.now()); a = d.agents.find(x => x.id === 'P0-02.1-test');
  assert(a.status === 'running' && a.display === 'running' && a.endTs === null && a.autoDone === false && a.progress === 80, 'a later report revives an automatically-done agent: ' + a.status + ' ' + a.progress);
  assert(d.working.length === 1, 'it is back in the strip');
  evAt(t0 + 90000, { agentId: 'P0-02.1-test', seq: 6, type: 'agent.done', message: 'RESULT: PASS' });
  evAt(t0 + 95000, { agentId: 'P0-02.1-test', seq: 7, type: 'agent.progress', progress: 50, message: 'stray' });
  d = M.derive(Date.now()); a = d.agents.find(x => x.id === 'P0-02.1-test');
  assert(a.status === 'done' && a.autoDone === false, 'a real done is final even if a stray progress follows');
  evAt(t0 + 100000, { agentId: 'P0-02.1-build', seq: 1, type: 'agent.start', message: 'go' });
  evAt(t0 + 110000, { agentId: 'P0-02.1-build', seq: 2, type: 'agent.done', message: 'stopped', data: { auto: true } });
  evAt(t0 + 130000, { agentId: 'P0-02.1-build', seq: 3, type: 'agent.activity', message: 'new calls', data: { calls: 2, untilTsMs: t0 + 125000 } });
  d = M.derive(Date.now()); a = d.agents.find(x => x.id === 'P0-02.1-build');
  assert(a.status === 'running' && a.progress === 99, 'tool calls made after an automatic done revive the agent (progress capped below 100)');
  console.log('AUTO-DONE TESTS PASSED');
}

// ---- expected durations from history ----
{
  reset();
  const now = Date.now();
  const span = (agent, run, start, mins, done) => {
    evAt(start, { agentId: agent, seq: 1, type: 'agent.start', message: 'go', runId: run, taskId: 'T' });
    if (mins != null) evAt(start + mins * 60000, { agentId: agent, seq: 2, type: done === false ? 'agent.fail' : 'agent.done', message: 'end', runId: run, taskId: 'T' });
  };
  span('P0-03-build', 'factory', now - 3600000, 8);
  span('P0-02-build', 'factory', now - 3000000, 12);
  span('P0-01-build', 'factory', now - 2400000, 30, false);
  span('P0-04-build', 'factory', now - 300000, null);
  span('P0-04-test', 'factory', now - 200000, null);
  span('arch-judge-domain', 'A', now - 3000000, 5);
  span('arch-judge-eng-lead', 'B', now - 100000, null);
  let d = M.derive(now);
  const g = id => d.agents.find(x => x.id === id);
  assert(g('P0-04-build').typicalMs === 10 * 60000 && g('P0-04-build').typicalN === 2 && g('P0-04-build').typicalBy === 'station:build', 'typical by station suffix, failed runs excluded: ' + g('P0-04-build').typicalMs);
  assert(g('P0-04-build').estPct === 50, 'estimated progress 5 of 10 min: ' + g('P0-04-build').estPct);
  assert(g('P0-04-test').typicalMs === null && g('P0-04-test').estPct === null, 'no history → no estimate');
  assert(g('P0-03-build').estPct === null, 'finished agents carry no estimate');
  M.state.selectedRun = 'B'; d = M.derive(now);
  assert(d.agents.length === 1 && d.agents[0].typicalMs === 5 * 60000 && d.agents[0].typicalBy === 'prefix:arch-judge', 'typical by prefix across runs: ' + JSON.stringify([d.agents[0].typicalMs, d.agents[0].typicalBy]));
  assert(d.agentsAll.length === 7, 'agentsAll keeps every run');
  M.state.selectedRun = 'all'; d = M.derive(now);
  assert(M.historyKey('P0-04-build') === 'station:build' && M.historyKey('P0-06.1-plan') === 'station:plan' && M.historyKey('arch-judge-domain') === 'prefix:arch-judge' && M.historyKey('arch-judge-eng-lead') === 'prefix:arch-judge' && M.historyKey('ux-critic-heuristics-a11y') === 'prefix:ux-critic' && M.historyKey('arch-synth') === 'prefix:arch' && M.historyKey('critic') === '' && M.historyKey('') === '', 'historyKey families');
  assert(M.typicalText(g('P0-04-build')) === 'typically ~10 min (build station, n=2, estimate)', 'typicalText: ' + M.typicalText(g('P0-04-build')));
  assert(M.typicalText(g('P0-04-test')) === '', 'typicalText empty without history');
  console.log('DURATION TESTS PASSED');
}

// ---- pure helpers ----
{
  const now = Date.now();
  const r = M.rateBuckets([{ tsMs: now - 30000 }, { tsMs: now - 90000 }, { tsMs: now - 90000 }, { tsMs: now - 31 * 60000 }, { tsMs: now }, { tsMs: now + 5000 }], now);
  assert(r.length === 30 && r[29] === 2 && r[28] === 2 && r.reduce((s, n) => s + n, 0) === 4, 'rateBuckets: ' + JSON.stringify(r));
  assert(M.quietClass(59999) === 'ok' && M.quietClass(60000) === 'warn' && M.quietClass(299999) === 'warn' && M.quietClass(300000) === 'serious' && M.quietClass(600000) === 'serious' && M.quietClass(600001) === 'stale' && M.quietClass(-5) === 'ok' && M.quietClass(NaN) === 'ok', 'quietClass thresholds');
  assert(M.fmtAgo(12400) === '12 s' && M.fmtAgo(61000) === '1 min' && M.fmtAgo(-5) === '0 s' && M.fmtAgo(3 * 3600000 + 120000) === '3 h 2 min' && M.fmtAgo(3 * 86400000) === '3 d', 'fmtAgo');
  assert(M.isFeedEvent({ type: 'agent.heartbeat' }) === false && M.isFeedEvent({ type: 'agent.activity' }) === false && M.isFeedEvent({ type: 'agent.progress' }) && M.isFeedEvent({ type: 'card.move' }), 'isFeedEvent');
  assert(M.classifyRemoval(100, 200, 1000) === 'evict' && M.classifyRemoval(300, 200, 1000) === 'prune' && M.classifyRemoval(100, 200, 10) === 'prune' && M.classifyRemoval(200, 200, 1000) === 'prune', 'classifyRemoval');
  assert(M.median([3, 1, 2]) === 2 && M.median([1, 2, 3, 4]) === 3 && M.median([]) === null, 'median');
  console.log('HELPER TESTS PASSED');
}

// ---- memory: eviction bookkeeping and the activity tick bound ----
{
  reset();
  const now = Date.now();
  for (let i = 0; i < 5300; i++) {
    const n = add({ id: 'e' + String(i).padStart(5, '0'), tsMs: now - (5300 - i) * 1000, type: 'agent.log', agentId: 'bulk', runId: 'r', message: 'x' });
    n.evicted = i < 4300; n.fromFile = i < 200;
  }
  const dropped = M.pruneMemory(M.state.events, M.EVENT_KEEP);
  assert(dropped === 300 && M.state.events.size === 5000, 'pruneMemory drops the 300 oldest evicted non-file events: ' + dropped + ' ' + M.state.events.size);
  for (let i = 0; i < 200; i++) assert(M.state.events.has('e' + String(i).padStart(5, '0')), 'file events are kept');
  for (let i = 200; i < 500; i++) assert(!M.state.events.has('e' + String(i).padStart(5, '0')), 'oldest evicted dropped');
  assert(M.state.events.has('e00500') && M.pruneMemory(M.state.events, M.EVENT_KEEP) === 0, 'nothing more to prune at the cap');
  const t1 = Date.now(); M.derive(now); M.derive(now); const sortedTwice = Date.now() - t1;
  assert(sortedTwice < 2000, 'derive on 5000 events is fast enough: ' + sortedTwice + ' ms for two calls');
  reset();
  for (let i = 0; i < 450; i++) add({ id: 't' + String(i).padStart(4, '0'), tsMs: now - 500000 + i * 1000, type: 'agent.activity', agentId: 'busy', runId: 'r', message: 'm', data: { calls: 1 } });
  add({ id: 's0000', tsMs: now - 600000, type: 'agent.start', agentId: 'busy', runId: 'r', message: 'go' });
  const d = M.derive(now); const a = d.agents[0];
  assert(a.activityTicks.length === 400 && a.activityTicks[399] === now - 500000 + 449000 && a.activityCount === 450, 'ticks bounded at 400 with the newest kept');
  console.log('MEMORY TESTS PASSED');
}

// ---- sync lag and working order ----
{
  reset();
  const now = Date.now();
  for (let i = 0; i < 5; i++) { const n = add({ id: 'l' + i, tsMs: now - 60000 + i * 1000, type: 'agent.log', agentId: 'x', runId: 'r', message: 'm' }); n.live = true; n.source = 'db'; n.arrivedAt = n.tsMs + 20000 + i * 1000; }
  assert(M.derive(now).syncLagMs === 22000, 'syncLagMs is the median arrival delay: ' + M.derive(now).syncLagMs);
  reset();
  const n = add({ id: 'l9', tsMs: now, type: 'agent.log', agentId: 'x', runId: 'r', message: 'm' }); n.live = true; n.source = 'db'; n.arrivedAt = now + 5000;
  assert(M.derive(now).syncLagMs === null, 'fewer than 3 samples → no figure');
  reset();
  evAt(now - 300000, { agentId: 'b', seq: 1, type: 'agent.start', message: 'go' });
  evAt(now - 200000, { agentId: 'a', seq: 1, type: 'agent.start', message: 'go' });
  evAt(now - 700000, { agentId: 'c', seq: 1, type: 'agent.start', message: 'go' });
  const d = M.derive(now);
  assert(d.working.map(x => x.id).join(',') === 'c,b,a', 'working sorted by start time: ' + d.working.map(x => x.id).join(','));
  assert(d.working[0].display === 'stale' && d.totals.stale === 1 && d.totals.running === 2, 'a stale agent stays in the strip');
  console.log('LAG AND ORDER TESTS PASSED');
}
