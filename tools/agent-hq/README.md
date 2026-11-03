# Agent HQ

An animated, illustrated neon-night office where every AI agent sits at its own desk. The room
shows live what each agent is working on, how far along it is, and how the whole project is going.
Everything is drawn in code (SVG + CSS), so it stays crisp at any size and animates at 60 fps.

## Run it

```sh
cd tools/agent-hq
pnpm install          # standalone: this folder has its own lockfile (see .npmrc)
pnpm dev              # http://localhost:5180
pnpm check            # biome lint + typecheck + unit tests + production build
pnpm fmt              # format with biome
pnpm build && pnpm preview   # serve the built app on http://localhost:5181
```

This folder is a standalone package: it has its own lockfile and its own Biome config, and the
repository root excludes it from the workspace and from the root lint.

## Data

All data lives behind one hook, `useAgents()` in `src/data/useAgents.ts`:

- `src/data/types.ts`: the `Agent`, `Project` and `HqSnapshot` types the UI consumes.
- `src/data/agents.ts`: the sample "Q4 Launch Campaign" (5 milestones, 8 agents) and the task pool.
- `src/data/demo.ts`: `demoStep()`, the pure simulation demo mode runs every 4 to 6 seconds.
- `src/data/live/`: the live source. `supabaseSource.ts` loads the office from Supabase and
  applies realtime changes; `state.ts` holds the pure reducers; `rows.ts` maps database rows to
  the app types. Any other backend can implement the same `AgentSource` interface.

Demo mode runs until the live source delivers its first snapshot; then the app switches to Live on
its own. The Demo/Live toggle in the top bar still lets you flip back. Besides realtime events the
source refetches everything once a minute and whenever the tab becomes visible again, so a missed
event can never leave the office stale.

## Going live (Supabase)

1. Create a Supabase project and run `supabase/migrations/20261103120000_agent_hq.sql` (paste it
   into the SQL editor, or `supabase db push` with the CLI). It creates `projects`, `agents` and
   `agent_activity` with the same fields as the app, read-only policies for the anon key, and
   realtime on all three tables. For a local stack instead (needs Docker), run
   `pnpm dlx supabase start` in this folder: `supabase/config.toml` is included, the migration is
   applied on start, and `pnpm dlx supabase status -o env` prints the URL and keys for step 2.
2. Copy `.env.example` to `.env` and fill in the URL, the anon key, the service role key and a
   secret for `AGENT_HQ_API_KEY` (`openssl rand -hex 32`).
3. `pnpm seed` loads the sample project and eight agents (`pnpm seed --reset` also resets activity).
4. Run the API server and the app:

   ```sh
   pnpm api          # http://127.0.0.1:8787, serves /api/* (and dist/ after a build)
   pnpm dev          # http://localhost:5180, proxies /api to the server
   ```

   For a wall monitor: `pnpm build` then `pnpm start`; the server serves the built app and the API
   on one port.

### Reporting status: `POST /api/agent-status`

Header `x-api-key: <AGENT_HQ_API_KEY>` (or `Authorization: Bearer <key>`). Body:

```json
{
  "agentId": "byte",
  "status": "working",
  "currentTask": "Landing page build in Next.js",
  "progress": 62,
  "activity": "Byte wired the CMS"
}
```

- `agentId` is required and must exist (add agents with the seed or an insert; unknown ids get 404).
- `status` is one of `working`, `thinking`, `waiting`, `blocked`, `idle`, `done`. A change stamps
  `statusSince`; leaving `waiting` or `blocked` clears `waitingOn` / `blockedReason`.
- `progress` is 0 to 100. `activity` is a string, a list of strings, or `{ "text", "kind" }`
  objects (`kind`: `done`, `start`, `status`, `note`). If the status changes and no activity is
  sent, the server logs a one-line entry for the feed.
- Optional extras with the same meaning as the app fields: `taskDescription`, `subtasks`
  (`[{ "label", "done" }]`), `waitingOn` (agent id or `"human"`), `blockedReason`, `nextUp`.

```sh
curl -X POST http://127.0.0.1:8787/api/agent-status \
  -H "content-type: application/json" -H "x-api-key: $AGENT_HQ_API_KEY" \
  -d '{"agentId":"nova","status":"done","progress":100,"activity":"Nova finished the keyword gap analysis"}'
```

Responses: `200 { ok, statusChanged, agent }`, `400` with `errors`, `401` bad key, `404` unknown
agent, `503` when the server is missing its configuration. `GET /api/health` reports configuration.

### Security notes

The browser holds only the anon key and can only read. Every write passes through the server, which
holds the service role key and checks the API key in constant time. Put the server behind HTTPS
when it leaves your machine, and rotate `AGENT_HQ_API_KEY` by restarting the server with a new value.

## Views

- **3D Office** (default on desktop): a Three.js office rendered with React Three Fiber and
  drei, built entirely from primitives in `src/three/`. Desk pods are laid out per agent
  (`layout.ts`, unit tested), robots sit, stand, wait or snack depending on status, the command
  wall carries the same HTML panels as the 2D wall, and the camera can orbit, zoom, pan and jump to
  zones or to a clicked agent. Loaded lazily; if WebGL is unavailable it offers the 2D office.
- **Iso Office**: the same office and the same simulation drawn in classic 2:1 isometric with
  Canvas 2D (`src/iso/`). Desks, walking, queueing, cafeteria life, follow mode, zone jumps and
  the TV tour behave exactly like the 3D view because both step one shared `CrowdSim`. Easier to
  extend: everything is a few hundred vector shapes sorted by depth, and all text is HTML.
- **2D Office**: the illustrated SVG/CSS scene.
- **List**: neon cards, the default on phones.

### Agents that move

The 3D robots are driven by a small simulation in `src/three/sim/` (unit tested, no browser needed):

- `navgrid.ts`: a 0.5-unit walkway grid built from the furniture (`buildObstacles` in `layout.ts`),
  A* with no corner cutting, and line-of-sight smoothing.
- `world.ts`: points of interest and shared resources: each agent's desk (chair, approach point
  behind it, standing spot), stroll spots, the counter queue, and cafeteria seats (agents prefer
  tables that already have company).
- `brain.ts`: one state machine per agent. A status becomes a plan: stand up, walk, turn, sit,
  queue, pick up a snack, celebrate, stroll. Working agents return with an "On it!" bubble; blocked
  ones stand at their desk with a hand on their head; waiting ones wander and keep a dashed line to
  whoever they wait on; idle and done ones queue at the counter and sit down to eat and chat.
- `Crowd.tsx` steps every brain each frame, keeps robots from walking through each other, and runs
  the table talk (speech bubbles, nods, the odd laugh). Only the first load places robots directly.

Demo mode flips at least one agent between work and rest every 10 to 15 seconds so there is always
someone getting up, walking over, or heading back.

### Camera, quality and effects

- Click an agent (robot or desk) and the camera flies to it and then follows it around until you
  click empty floor; orbit freely while following. Zone buttons jump the camera.
- TV mode runs a cinematic tour that glides between the work floor, the command wall, the
  cafeteria and an overview, cutting to any agent whose status just changed for a few seconds.
- Quality: High has bloom, the reflective floor, full resolution and antialiasing; Low drops them and
  renders at a lower resolution. The choice is remembered. If the frame rate stays under about 28
  fps for a few seconds, the view switches to Low on its own and says so. Phones start on Low.
- Desks, chairs, monitors, stools, mullions and wall screens are instanced; there are only a few real
  lights, glowing materials and bloom do the rest. Soft contact shadows are generated gradient
  textures, and the haze is a handful of drifting additive sprites.
- With `prefers-reduced-motion`, agents still walk to where they need to be, but camera flights become
  cuts, the tour stops gliding, and the haze, bobbing and spinning markers hold still.

### Isometric view

`src/iso/projection.ts` holds the 2:1 projection (`project`, `unproject`, `fitCamera`, depth
order, unit tested). `IsoRenderer.ts` draws the backdrop (skyline, floor, glass walls, neon),
then collects every furniture piece and robot as a drawable with a depth of x+z and paints them
in order each frame at device pixel ratio. `IsoOffice.tsx` owns the camera (drag to pan, wheel
or pinch to zoom, fit-to-room on load, zone presets, follow, TV tour), steps the shared
`CrowdSim`, and positions the HTML overlay (tags, bubbles, name plates, the three wall panels)
from the same projection. Tags carry `data-agent` and `data-mode` like the 3D ones.

## Components

`TopBar`, `OfficeScene` (stage + room), `ScreenWall` (with `FeedPanel`, `OverviewPanel` and
`StatsPanel`, shared with the 3D wall), `HoloGlobe`, `Desk`, `AgentAvatar`, `AgentTag`,
`AgentDrawer`, `ListView`, plus `ProgressRing`, `StatusIcon` and `RoomDressing`. The 3D view adds
`Office3D`, `Scene`, `Room`, `Skyline`, `CommandWall`, `DeskPod`, `Cafeteria`, `Robot3D`,
`AgentTag3D` and `CameraRig`.

The office is a fixed 1600x900 stage scaled to fit its container; `src/lib/layout.ts` places desks
in rows (front row first, back rows smaller) with a centre aisle for the globe, for any number of
agents.

## Accessibility and motion

Every status has a colour, an icon, a label and an animation. With `prefers-reduced-motion`, all
ambient animation stops and every piece of information stays. Desks and cards are buttons, the
drawer is a dialog, and Escape closes it (or leaves TV mode).
