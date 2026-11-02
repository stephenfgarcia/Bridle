// Headless test of the Bridle Build Monitor derivation logic. Run: node tools/monitor/test/monitor.test.js
const vm = require('vm');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const src = html.slice(html.indexOf('<script>\n') + 9, html.lastIndexOf('\n</script>'));
const ctx = { console, Date, Map, Set, Array, Object, Number, String, Math, isFinite, Infinity, globalThis: {} };
ctx.globalThis = ctx;
vm.runInNewContext(src, ctx);
const M = ctx.BridleMonitor;
if (!M) throw new Error('BridleMonitor not exposed');
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
for (const e of events) { const n = M.normEvent(e, e.id, 'db'); if (!n) throw new Error('norm failed ' + e.id); M.state.events.set(n.id, n); }
const d = M.derive(Date.now());
const t = Object.fromEntries(d.tasks.map(t => [t.id, t]));
const a = Object.fromEntries(d.agents.map(a => [a.id, a]));
const assert = (c, m) => { if (!c) throw new Error('ASSERT ' + m); };
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
assert(d.totals.tasks === M.SEED_TASKS.length, 'task count ' + d.totals.tasks);
assert(d.totals.stale === 1 && d.totals.failed === 1 && d.totals.running === 1 && d.totals.doneAgents === 1, 'totals ' + JSON.stringify(d.totals));
assert(d.current && d.current.id === 'PLAN', 'current phase PLAN');
// run filter
M.state.selectedRun = 'wf_old';
const d2 = M.derive(Date.now());
assert(d2.agents.length === 1 && d2.agents[0].id === 'old-agent', 'run filter');
M.state.selectedRun = 'nope';
assert(M.derive(Date.now()).runFilter === 'all', 'unknown run falls back to all');
// explicit later task.status wins over agents
M.state.selectedRun = 'all';
const late = M.normEvent(mk(50, { type: 'task.status', taskId: 'PLAN-02', status: 'review', progress: 90, message: 'needs instructor eyes' }), undefined, 'db');
M.state.events.set(late.id, late);
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
                   mv(4, 'P0-03', 'ship', 'done', 'orchestrator')]) { const n = M.normEvent(e, e.id, 'db'); M.state.events.set(n.id, n); }
  { const p = M.normEvent(mk(59, { type: 'task.status', taskId: 'P0-01', status: 'done' }), undefined, 'db'); M.state.events.set(p.id, p); }
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
  // finish PLAN-01 -> PLAN-02 becomes next up (PLAN-03 also unblocked but later in order)
  const fin = M.normEvent(mk(60, { type: 'task.status', taskId: 'PLAN-01', status: 'done' }), undefined, 'db'); M.state.events.set(fin.id, fin);
  const d5 = M.derive(Date.now());
  assert(d5.nextUp && d5.nextUp.task.id === 'PLAN-03', 'next up is PLAN-03 (PLAN-02 is in review, so not eligible), got ' + (d5.nextUp && d5.nextUp.task.id));
  assert(!d5.cards.some(x => x.task.placeholder && d5.nextUp && d5.nextUp.task.id === x.task.id), 'placeholders never next up');
  console.log('FACTORY TESTS PASSED', { cards: d5.cards.length, nextUp: d5.nextUp.task.id });
}
