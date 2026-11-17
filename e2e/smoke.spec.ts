// The smoke test of apps/web (card P0-02.5; the locale since card P0-02.6; the shell since card PX-02.1; the
// 3D viewport since card PX-02.2; the model store since card PX-02.3; the tools since card PX-02.4; supports and
// loads since card PX-02.5; the live analysis since card PX-02.8): the health route, then the home page and its screenshot, then the workspace route with the navigation, then the
// viewport with the side panel's counts, the Undo and Redo buttons, the issues and the fixture switch, then
// hovering and selecting a member in the viewport, then a new model with two nodes and a member drawn with
// the Node and the Member tool, then a nodal load placed with the Load tool and a uniform load added to the
// beam of the portal frame from the side panel, then the live analysis of the portal frame (its reactions, the
// removal of its supports, the unstable frame on two pinned bases, the truss the solver does not take yet), then
// a solver worker that cannot be made and the Retry button, then the property panel (card PX-02.6): a section
// added in "Sections and materials", the two columns of the portal frame selected with Shift-click and given
// that section, "Colour by section", and Delete on several items.
// The health test is first: when a foreign process holds the port, its failure names the cause.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";

// The locale under test: NEXT_PUBLIC_LOCALE as apps/web reads it (Playwright's webServer inherits it), `en`
// when it is unset or empty. The strings the page must show are read from that locale's catalog, not typed
// here. The root package is not an ES module, hence __dirname.
const LOCALE = process.env.NEXT_PUBLIC_LOCALE?.trim() || "en";
const CATALOG: Record<string, string> = JSON.parse(
  readFileSync(
    path.join(__dirname, "..", "packages", "i18n", "messages", `${LOCALE}.json`),
    "utf8",
  ),
);

function message(id: string): string {
  const value = CATALOG[id];
  if (value === undefined) {
    throw new Error(`the ${LOCALE} catalog has no message ${id}`);
  }
  return value;
}

// The sha the server must report: GIT_SHA when set, else the checkout's HEAD (what apps/web/src/sha.ts reads).
function expectedSha(): string {
  const fromEnv = process.env.GIT_SHA?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
}

// Where a screenshot goes: .bridle/screenshots/<name>.png, with the locale in the name when it is not `en`.
// config.rootDir is e2e and the root package is not an ES module (no import.meta): the repository root is
// the directory of the configuration file (configFile is typed optional: without it, the parent of e2e).
function screenshotPath(testInfo: TestInfo, name: string): string {
  const { configFile, rootDir } = testInfo.config;
  const root = path.dirname(configFile ?? rootDir);
  return path.join(
    root,
    ".bridle",
    "screenshots",
    LOCALE === "en" ? `${name}.png` : `${name}-${LOCALE}.png`,
  );
}

test("GET /api/v1/health answers ok with the sha", async ({ request }) => {
  const response = await request.get("/api/v1/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(await response.json()).toEqual({ ok: true, sha: expectedSha() });
});

test("/ says Bridle with the sha and the educational-use notice", async ({ page }, testInfo) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  // The locale first: against a server of another locale, the failure names both.
  await expect(page.locator("html")).toHaveAttribute("lang", LOCALE);
  await expect(page).toHaveTitle(message("app.name"));
  await expect(page.locator("h1")).toHaveText(message("app.name"));
  await expect(page.getByTestId("sha")).toHaveText(expectedSha());
  await expect(page.getByTestId("notice")).toHaveText(message("home.notice"));
  await expect(
    page.getByRole("link", { name: message("home.openWorkspace"), exact: true }),
  ).toHaveAttribute("href", "/workspace");
  await page.screenshot({ path: screenshotPath(testInfo, "smoke-home"), fullPage: true });
});

test("/workspace shows the navigation, the viewport area and the side panel", async ({ page }) => {
  const response = await page.goto("/workspace");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", LOCALE);
  const nav = page.getByRole("navigation", { name: message("nav.label"), exact: true });
  await expect(nav).toBeVisible();
  const workspace = nav.getByRole("link", { name: message("nav.workspace"), exact: true });
  await expect(workspace).toHaveAttribute("href", "/workspace");
  await expect(workspace).toHaveAttribute("aria-current", "page");
  const tasks = nav.getByRole("link", { name: message("nav.tasks"), exact: true });
  await expect(tasks).toHaveAttribute("href", "/tasks");
  await expect(tasks).not.toHaveAttribute("aria-current");
  await expect(page.getByTestId("viewport")).toBeVisible();
  await expect(page.getByTestId("side-panel")).toBeVisible();
});

// The canvas of the viewport: it is there once the page has hydrated and loaded the 3D code, so a test that
// waits for it may then use the controls.
async function openViewport(page: Page) {
  const response = await page.goto("/workspace");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", LOCALE);
  await expect(page.getByTestId("viewport").locator("canvas")).toBeVisible();
}

async function expectCounts(page: Page, nodes: number, members: number, supports: number) {
  await expect(page.getByTestId("count-nodes")).toHaveText(String(nodes));
  await expect(page.getByTestId("count-members")).toHaveText(String(members));
  await expect(page.getByTestId("count-supports")).toHaveText(String(supports));
}

async function expectFreshHistory(page: Page) {
  for (const id of ["undo", "redo"]) {
    const button = page
      .getByTestId("viewport")
      .getByRole("button", { name: message(`workspace.history.${id}`), exact: true });
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
  }
}

async function expectNoIssues(page: Page) {
  const panel = page.getByTestId("side-panel");
  await expect(panel.getByTestId("issues-status")).toHaveText(message("workspace.issues.none"));
  await expect(panel.getByTestId("issues")).toHaveCount(0);
}

test("/workspace draws the portal frame and the fixture switch changes the counts", async ({
  page,
}, testInfo) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("console", (entry) => {
    if (entry.type() === "error" && /hydrat/i.test(entry.text())) {
      problems.push(`console error: ${entry.text()}`);
    }
  });
  await openViewport(page);
  const panel = page.getByTestId("side-panel");
  const fixture = panel.getByLabel(message("workspace.fixture.label"), { exact: true });
  // The portal frame first: 4 nodes, 3 members, 2 supports.
  await expect(fixture).toHaveValue("portal");
  await expectCounts(page, 4, 3, 2);
  await expect(panel.getByTestId("selection-empty")).toHaveText(message("workspace.panel.empty"));
  for (const id of ["fit", "view3d", "viewFront", "viewTop"]) {
    await expect(
      page
        .getByTestId("viewport")
        .getByRole("button", { name: message(`workspace.viewport.${id}`), exact: true }),
    ).toBeVisible();
  }
  // A fresh workspace has nothing to undo or redo, and the portal frame has no issue.
  await expectFreshHistory(page);
  await expectNoIssues(page);
  // The viewport of the Desktop Chrome device is 1280 by 720: the laptop screen the shell is laid out for.
  await page.screenshot({ path: screenshotPath(testInfo, "smoke-workspace") });
  await fixture.selectOption("truss");
  await expectCounts(page, 5, 7, 5);
  await expectNoIssues(page);
  await fixture.selectOption("beam");
  await expectCounts(page, 2, 1, 2);
  await expectNoIssues(page);
  await fixture.selectOption("portal");
  await expectCounts(page, 4, 3, 2);
  // Loading a model is not an undo step, and the three example models have no issue.
  await expectFreshHistory(page);
  await expectNoIssues(page);
  await expect(page.getByTestId("viewport").locator("canvas")).toBeVisible();
  // No error was thrown in the page, and the console holds no hydration error.
  expect(problems).toEqual([]);
});

test("/workspace highlights the member under the pointer and a click selects it", async ({
  page,
}) => {
  await openViewport(page);
  await page
    .getByTestId("viewport")
    .getByRole("button", { name: message("workspace.viewport.viewFront"), exact: true })
    .click();
  const surface = page.getByTestId("viewport-surface");
  const box = await page.getByTestId("viewport").boundingBox();
  if (box === null) {
    throw new Error("the viewport area has no box");
  }
  // Seen from the front, the beam b1 of the portal frame crosses the middle of the viewport above its centre:
  // the pointer goes down the middle until the viewport says it is over the beam.
  const x = box.x + box.width / 2;
  let y = box.y + 8;
  const middle = box.y + box.height / 2;
  for (; y < middle; y += 3) {
    await page.mouse.move(x, y);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    if ((await surface.getAttribute("data-hover")) === "member:b1") {
      break;
    }
  }
  await expect(surface).toHaveAttribute("data-hover", "member:b1");
  const panel = page.getByTestId("side-panel");
  await expect(panel.getByTestId("selection-empty")).toBeVisible();
  await page.mouse.click(x, y);
  const selection = panel.getByTestId("selection");
  const named = (name: string, id: string) =>
    message("workspace.selection.named").replace("{name}", name).replace("{id}", id);
  for (const text of [
    message("workspace.selection.kindMember"),
    "b1",
    "n2",
    "n3",
    named("I 300x150", "s1"),
    named("S355", "mat1"),
  ]) {
    await expect(selection).toContainText(text);
  }
  // The middle of the viewport is inside the frame, on no member: a click there clears the selection.
  await page.mouse.click(x, middle);
  await expect(panel.getByTestId("selection-empty")).toHaveText(message("workspace.panel.empty"));
});

// The point the Node or the Member tool would act at, as the viewport reports it (`data-cursor`, "x,y,z" in
// metres), once the page has drawn a frame after the last pointer move; `null` when there is none.
async function cursorPoint(page: Page): Promise<[number, number, number] | null> {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const text = await page.getByTestId("viewport-surface").getAttribute("data-cursor");
  if (!text) {
    return null;
  }
  const [x = Number.NaN, y = Number.NaN, z = Number.NaN] = text.split(",").map(Number);
  return [x, y, z];
}

// Moves the pointer, in the Front view with a drawing tool active, until the viewport reports the point
// (x, 0, z) under it, and returns where the pointer then is. No pixel is assumed: two probes give the scale
// of the picture, and the pointer is corrected by what the viewport reports until it reads the target.
async function movePointerTo(page: Page, x: number, z: number): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId("viewport").boundingBox();
  if (box === null) {
    throw new Error("the viewport area has no box");
  }
  // Inside the canvas, clear of the toolbar at the top and of the status lines at the bottom.
  const clampX = (value: number) => Math.min(box.x + box.width - 40, Math.max(box.x + 40, value));
  const clampY = (value: number) => Math.min(box.y + box.height - 90, Math.max(box.y + 70, value));
  const first = { x: box.x + 200, y: box.y + box.height - 200 };
  const second = { x: box.x + box.width - 200, y: box.y + 200 };
  await page.mouse.move(first.x, first.y);
  const a = await cursorPoint(page);
  await page.mouse.move(second.x, second.y);
  const b = await cursorPoint(page);
  if (a === null || b === null || a[0] === b[0] || a[2] === b[2]) {
    throw new Error(`the probes read ${a} and ${b}`);
  }
  const perMetreX = (second.x - first.x) / (b[0] - a[0]);
  const perMetreY = (second.y - first.y) / (b[2] - a[2]);
  let px = clampX(second.x + (x - b[0]) * perMetreX);
  let py = clampY(second.y + (z - b[2]) * perMetreY);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.mouse.move(px, py);
    const at = await cursorPoint(page);
    if (at === null) {
      throw new Error(`no cursor at ${px}, ${py}`);
    }
    if (at[0] === x && at[1] === 0 && at[2] === z) {
      return { x: px, y: py };
    }
    px = clampX(px + (x - at[0]) * perMetreX);
    py = clampY(py + (z - at[2]) * perMetreY);
  }
  throw new Error(`the pointer did not reach ${x}, 0, ${z}`);
}

test("/workspace draws two nodes and a member in a new model, and undoes the member", async ({
  page,
}, testInfo) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  await openViewport(page);
  const viewport = page.getByTestId("viewport");
  const surface = page.getByTestId("viewport-surface");
  const panel = page.getByTestId("side-panel");
  const tool = (id: string) =>
    viewport.getByRole("button", { name: message(`workspace.tools.${id}`), exact: true });
  // The palette: Select is the active tool, and each tool's tooltip names its key.
  await expect(
    viewport.getByRole("toolbar", { name: message("workspace.tools.label") }),
  ).toBeVisible();
  await expect(tool("select")).toHaveAttribute("aria-pressed", "true");
  await expect(tool("node")).toHaveAttribute("aria-pressed", "false");
  await expect(tool("member")).toHaveAttribute("title", /\(M\)/);
  await expect(surface).toHaveAttribute("data-tool", "select");
  // The defaults of the work plane and the snap.
  await expect(viewport.getByTestId("work-plane")).toHaveValue("xz");
  await expect(viewport.getByTestId("work-plane-offset")).toHaveValue("0");
  await expect(viewport.getByTestId("snap-step")).toHaveValue("0.5");

  // A new model: the portal frame has no change, so nothing is asked.
  await panel.getByRole("button", { name: message("workspace.model.new"), exact: true }).click();
  await expectCounts(page, 0, 0, 0);
  await expectFreshHistory(page);
  await viewport
    .getByRole("button", { name: message("workspace.viewport.viewFront"), exact: true })
    .click();

  // Two nodes with the Node tool.
  await tool("node").click();
  await expect(tool("node")).toHaveAttribute("aria-pressed", "true");
  await expect(surface).toHaveAttribute("data-tool", "node");
  const first = await movePointerTo(page, 1, 1);
  await expect(viewport.getByTestId("cursor-readout")).toHaveText(
    message("workspace.cursor.readout").replace("{x}", "1").replace("{y}", "0").replace("{z}", "1"),
  );
  await page.mouse.click(first.x, first.y);
  await expectCounts(page, 1, 0, 0);
  // The placed node is selected: its coordinates are fields of the side panel.
  await expect(panel.getByTestId("node-x")).toHaveValue("1");
  await expect(panel.getByTestId("node-z")).toHaveValue("1");
  const second = await movePointerTo(page, 5, 3.5);
  await page.mouse.click(second.x, second.y);
  await expectCounts(page, 2, 0, 0);
  // A click on a point that has a node places no second one.
  await page.mouse.click(second.x, second.y);
  await expectCounts(page, 2, 0, 0);

  // A press and release far apart is a drag of the camera: it places nothing.
  await page.mouse.move(first.x + 150, first.y);
  await page.mouse.down();
  await page.mouse.move(first.x + 190, first.y - 20, { steps: 4 });
  await page.mouse.up();
  await expectCounts(page, 2, 0, 0);
  await viewport
    .getByRole("button", { name: message("workspace.viewport.viewFront"), exact: true })
    .click();

  // The member, with the Member tool chosen by its key: from the first node to the second.
  await page.keyboard.press("m");
  await expect(tool("member")).toHaveAttribute("aria-pressed", "true");
  const start = await movePointerTo(page, 1, 1);
  await page.mouse.click(start.x, start.y);
  await expect(surface).toHaveAttribute("data-member-start", "n1");
  await expectCounts(page, 2, 0, 0);
  const end = await movePointerTo(page, 5, 3.5);
  await page.mouse.click(end.x, end.y);
  await expectCounts(page, 2, 1, 0);
  await expect(surface).toHaveAttribute("data-member-start", "n2");
  // The same two nodes again: refused, with a message, and the model is as it was.
  await page.mouse.click(start.x, start.y);
  await expect(viewport.getByTestId("tool-notice")).toHaveText(
    message("workspace.notice.duplicateMember"),
  );
  await expectCounts(page, 2, 1, 0);
  await page.screenshot({ path: screenshotPath(testInfo, "smoke-tools") });
  // Escape ends the member in progress and returns to Select.
  await page.keyboard.press("Escape");
  await expect(surface).toHaveAttribute("data-tool", "select");
  await expect(surface).toHaveAttribute("data-member-start", "");
  await expect(tool("select")).toHaveAttribute("aria-pressed", "true");
  await expect(viewport.getByTestId("tool-notice")).toHaveCount(0);

  // Undo takes the member and leaves its two nodes; redo brings it back.
  const history = (id: string) =>
    viewport.getByRole("button", { name: message(`workspace.history.${id}`), exact: true });
  await history("undo").click();
  await expectCounts(page, 2, 0, 0);
  await history("redo").click();
  await expectCounts(page, 2, 1, 0);
  await history("undo").click();
  await expectCounts(page, 2, 0, 0);
  expect(problems).toEqual([]);
});

test("/workspace adds a nodal load with the Load tool and a uniform load on the beam from the side panel", async ({
  page,
}, testInfo) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  await openViewport(page);
  const viewport = page.getByTestId("viewport");
  const surface = page.getByTestId("viewport-surface");
  const panel = page.getByTestId("side-panel");
  const label = (key: string) => viewport.locator(`[data-testid="load-label"][data-load="${key}"]`);
  const row = (id: string) => panel.locator(`[data-testid="load-row"][data-load="${id}"]`);
  const value = (id: string, text: string) => message(id).replace("{value}", text);
  // The portal frame example: its one load, 20 kN along X at n2, is drawn with its value.
  await expect(panel.getByLabel(message("workspace.fixture.label"), { exact: true })).toHaveValue(
    "portal",
  );
  await expect(surface).toHaveAttribute("data-loads", "1");
  await expect(label("nl1:fx")).toHaveText(value("workspace.loads.valueKN", "20"));
  await expect(panel.getByTestId("load-case")).toHaveCount(1);
  await expect(panel.getByTestId("load-case")).toHaveAttribute("data-active", "true");
  await viewport
    .getByRole("button", { name: message("workspace.viewport.viewFront"), exact: true })
    .click();

  // The Load tool: 15 kN downward (-15 in Z), placed on the node n3 at (6, 0, 4).
  const loadTool = viewport.getByRole("button", {
    name: message("workspace.tools.load"),
    exact: true,
  });
  await loadTool.click();
  await expect(loadTool).toHaveAttribute("aria-pressed", "true");
  await expect(surface).toHaveAttribute("data-tool", "load");
  await expect(viewport.getByTestId("load-tool-component")).toHaveValue("fz");
  await viewport.getByTestId("load-tool-value").fill("-15");
  await viewport.getByTestId("load-tool-value").press("Enter");
  const node = await movePointerTo(page, 6, 4);
  await expect(surface).toHaveAttribute("data-hover", "node:n3");
  await page.mouse.click(node.x, node.y);
  await expect(surface).toHaveAttribute("data-loads", "2");
  await expect(label("nl2:fz")).toHaveText(value("workspace.loads.valueKN", "15"));
  await expect(label("nl2:fz")).toBeVisible();
  // The node is selected, and the side panel lists the load: its component and its signed value.
  await expect(panel.getByTestId("selection")).toContainText("n3");
  const nodal = row("nl2");
  await expect(nodal).toHaveCount(1);
  await expect(nodal.getByTestId("load-component")).toHaveValue("fz");
  await expect(nodal.getByTestId("load-value")).toHaveValue("-15");
  await expect(panel.getByTestId("node-loads").getByTestId("load-row")).toHaveCount(1);
  // A click of the Load tool away from every node adds nothing and says why.
  const nowhere = await movePointerTo(page, 3, 2);
  await page.mouse.click(nowhere.x, nowhere.y);
  await expect(viewport.getByTestId("tool-notice")).toHaveText(
    message("workspace.notice.needsNode"),
  );
  await expect(surface).toHaveAttribute("data-loads", "2");
  await page.keyboard.press("Escape");
  await expect(surface).toHaveAttribute("data-tool", "select");

  // The beam b1, selected in the viewport as in the test above.
  const box = await viewport.boundingBox();
  if (box === null) {
    throw new Error("the viewport area has no box");
  }
  const x = box.x + box.width / 2;
  let y = box.y + 8;
  for (; y < box.y + box.height / 2; y += 3) {
    await page.mouse.move(x, y);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    if ((await surface.getAttribute("data-hover")) === "member:b1") {
      break;
    }
  }
  await expect(surface).toHaveAttribute("data-hover", "member:b1");
  await page.mouse.click(x, y);
  await expect(panel.getByTestId("selection")).toContainText("b1");
  const memberLoads = panel.getByTestId("member-loads");
  await expect(memberLoads.getByTestId("load-list-empty")).toHaveText(
    message("workspace.loads.none"),
  );

  // "Add uniform load": 12 kN/m downward in global axes.
  await memberLoads
    .getByRole("button", { name: message("workspace.loads.addUniform"), exact: true })
    .click();
  await expect(memberLoads.getByTestId("new-load-axes")).toHaveValue("global");
  await expect(memberLoads.getByTestId("new-load-direction")).toHaveValue("z");
  await memberLoads.getByTestId("new-load-value").fill("-12");
  await memberLoads
    .getByRole("button", { name: message("workspace.loads.add"), exact: true })
    .click();
  // It is read back from the list of the member's loads, and it is drawn.
  const uniform = row("ul1");
  await expect(uniform).toHaveCount(1);
  await expect(uniform.getByTestId("load-axes")).toHaveValue("global");
  await expect(uniform.getByTestId("load-direction")).toHaveValue("z");
  await expect(uniform.getByTestId("load-value")).toHaveValue("-12");
  await expect(memberLoads.getByTestId("new-load")).toHaveCount(0);
  await expect(surface).toHaveAttribute("data-loads", "3");
  await expect(label("ul1")).toHaveText(value("workspace.loads.valueKNPerM", "12"));
  await expect(label("ul1")).toBeVisible();
  await page.screenshot({ path: screenshotPath(testInfo, "smoke-loads") });

  // A point load beyond the 6 m of the beam is refused with a message; the model keeps its three loads.
  await memberLoads
    .getByRole("button", { name: message("workspace.loads.addPoint"), exact: true })
    .click();
  await expect(memberLoads.getByTestId("new-load-length")).toHaveText(
    message("workspace.loads.memberLength").replace("{length}", "6"),
  );
  await expect(memberLoads.getByTestId("new-load-position")).toHaveValue("3");
  await memberLoads.getByTestId("new-load-position").fill("7");
  await memberLoads
    .getByRole("button", { name: message("workspace.loads.add"), exact: true })
    .click();
  await expect(viewport.getByTestId("tool-notice")).toHaveText(
    message("workspace.notice.positionOutside"),
  );
  await expect(memberLoads.getByTestId("load-row")).toHaveCount(1);
  await expect(surface).toHaveAttribute("data-loads", "3");
  await memberLoads
    .getByRole("button", { name: message("workspace.loads.cancel"), exact: true })
    .click();

  // An edit of the value in the list changes the label; Remove takes the load away and Undo brings it back.
  await uniform.getByTestId("load-value").fill("-8");
  await uniform.getByTestId("load-value").press("Enter");
  await expect(label("ul1")).toHaveText(value("workspace.loads.valueKNPerM", "8"));
  await expect(viewport.getByTestId("tool-notice")).toHaveCount(0);
  await uniform.getByTestId("load-remove").click();
  await expect(row("ul1")).toHaveCount(0);
  await expect(surface).toHaveAttribute("data-loads", "2");
  await viewport
    .getByRole("button", { name: message("workspace.history.undo"), exact: true })
    .click();
  await expect(row("ul1").getByTestId("load-value")).toHaveValue("-8");
  await expect(surface).toHaveAttribute("data-loads", "3");
  expect(problems).toEqual([]);
});

// The status of the live analysis, as the status area reports it (`data-status`). The first analysis of a
// page waits for the worker's code, which the dev server compiles on demand: hence the longer timeout.
async function expectStatus(page: Page, status: string) {
  await expect(page.getByTestId("analysis-status")).toHaveAttribute("data-status", status, {
    timeout: 30_000,
  });
}

// The number in a printed value: the text without what the unit's message puts around `{value}`.
function numberIn(text: string, unitMessage: string): number {
  const [before = "", after = ""] = message(unitMessage).split("{value}");
  expect(text.startsWith(before) && text.endsWith(after), `"${text}" as ${unitMessage}`).toBe(true);
  return Number(text.slice(before.length, text.length - after.length));
}

// The horizontal reactions the Results section prints, one per support, in kN.
async function horizontalReactions(page: Page): Promise<number[]> {
  const cells = page
    .getByTestId("results")
    .locator('[data-testid="reaction"] [data-testid="result-value"][data-component="fx"]');
  const values: number[] = [];
  for (const text of await cells.allTextContents()) {
    values.push(numberIn(text, "workspace.loads.valueKN"));
  }
  return values;
}

test("/workspace analyses the portal frame as it changes and says when it cannot", async ({
  page,
}, testInfo) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  await openViewport(page);
  const viewport = page.getByTestId("viewport");
  const panel = page.getByTestId("side-panel");
  const status = page.getByTestId("analysis-status");
  const results = panel.getByTestId("results");
  const reactions = results.getByTestId("reaction");
  const sumFx = results
    .getByTestId("reaction-sum")
    .locator('[data-testid="result-value"][data-component="fx"]');
  const kN = (text: string) => message("workspace.loads.valueKN").replace("{value}", text);
  const history = (id: string) =>
    viewport.getByRole("button", { name: message(`workspace.history.${id}`), exact: true });

  // The portal frame is analysed on opening: 20 kN along +X at n2, so the two horizontal reactions sum to
  // -20 kN. Each is printed with four significant digits, hence the tolerance of two last digits.
  await expectStatus(page, "analysed");
  await expect(status.getByTestId("analysis-title")).toHaveText(
    message("workspace.analysis.analysed"),
  );
  await expect(status.getByTestId("analysis-time")).toBeVisible();
  await expect(results).toHaveAttribute("data-stale", "false");
  await expect(results).toHaveAttribute("data-load-case", "lc1");
  await expect(reactions).toHaveCount(2);
  await expect(reactions.nth(0)).toHaveAttribute("data-node", "n1");
  await expect(reactions.nth(1)).toHaveAttribute("data-node", "n4");
  await expect(reactions.nth(0).getByTestId("result-value")).toHaveCount(6);
  const portal = await horizontalReactions(page);
  expect(portal).toHaveLength(2);
  expect(Math.abs((portal[0] ?? 0) + (portal[1] ?? 0) + 20)).toBeLessThan(0.02);
  for (const value of portal) {
    expect(value).toBeLessThan(0);
  }
  await expect(sumFx).toHaveText(kN("-20.00"));
  await results.scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshotPath(testInfo, "smoke-analysis") });

  // A support is deleted (the Support tool on a node that has the chosen support removes it): the frame
  // stands on n1 alone, is analysed again, and n1 carries the whole 20 kN.
  await viewport
    .getByRole("button", { name: message("workspace.viewport.viewFront"), exact: true })
    .click();
  await viewport
    .getByRole("button", { name: message("workspace.tools.support"), exact: true })
    .click();
  await expect(viewport.getByTestId("support-choice")).toHaveValue("fixed");
  const n4 = await movePointerTo(page, 6, 0);
  await page.mouse.click(n4.x, n4.y);
  await expectCounts(page, 4, 3, 1);
  await expectStatus(page, "analysed");
  await expect(reactions).toHaveCount(1);
  await expect(
    reactions.nth(0).locator('[data-testid="result-value"][data-component="fx"]'),
  ).toHaveText(kN("-20.00"));
  // The node the tool acted on is selected: its displacement is in the Results section, in mm and rad.
  const displacement = results.getByTestId("node-displacement");
  await expect(displacement).toHaveAttribute("data-node", "n4");
  await expect(displacement.getByTestId("result-value")).toHaveCount(6);
  const ux =
    (await displacement
      .locator('[data-testid="result-value"][data-component="ux"]')
      .textContent()) ?? "";
  // The frame now stands on n1 alone, so the foot of the other column moves.
  expect(Math.abs(numberIn(ux, "workspace.results.valueMm"))).toBeGreaterThan(0.01);

  // The last support is deleted: the model has an issue, it is not analysed and no result is shown.
  const n1 = await movePointerTo(page, 0, 0);
  await page.mouse.click(n1.x, n1.y);
  await expectCounts(page, 4, 3, 0);
  await expectStatus(page, "issues");
  await expect(status.getByTestId("analysis-title")).toHaveText(
    message("workspace.analysis.issues"),
  );
  await expect(results).toHaveCount(0);

  // Undo and redo are followed: one support, two supports, one support, two supports.
  await history("undo").click();
  await expectStatus(page, "analysed");
  await expect(reactions).toHaveCount(1);
  await history("undo").click();
  await expectStatus(page, "analysed");
  await expect(reactions).toHaveCount(2);
  await expect(sumFx).toHaveText(kN("-20.00"));
  await history("redo").click();
  await expectStatus(page, "analysed");
  await expect(reactions).toHaveCount(1);
  await history("undo").click();
  await expect(reactions).toHaveCount(2);

  // Both bases pinned: the frame can turn about the line through its bases. The status says so, names a
  // node and a direction, shows no result, and offers "Restrain out of plane".
  await viewport.getByTestId("support-choice").selectOption("pinned");
  await page.mouse.click(n1.x, n1.y);
  await expectCounts(page, 4, 3, 2);
  await expectStatus(page, "analysed");
  await page.mouse.click(n4.x, n4.y);
  await expectStatus(page, "unstable");
  await expect(status.getByTestId("analysis-title")).toHaveText(
    message("workspace.analysis.unstable"),
  );
  const sentences: string[] = [];
  for (const dof of ["Ux", "Uy", "Uz", "Rx", "Ry", "Rz"]) {
    for (const node of ["n1", "n2", "n3", "n4"]) {
      sentences.push(message(`workspace.analysis.unstable${dof}`).replace("{node}", node));
    }
  }
  expect(sentences).toContain(await status.getByTestId("analysis-where").textContent());
  await expect(results).toHaveCount(0);
  await page.screenshot({ path: screenshotPath(testInfo, "smoke-unstable") });
  await status.getByTestId("analysis-restrain").click();
  await expectStatus(page, "analysed");
  await expectCounts(page, 4, 3, 4);
  await expect(reactions).toHaveCount(4);
  await expect(sumFx).toHaveText(kN("-20.00"));
  const pinned = await horizontalReactions(page);
  expect(Math.abs(pinned.reduce((sum, value) => sum + value, 0) + 20)).toBeLessThan(0.04);

  // The truss example has truss members, which the solver does not take yet: the status names them.
  const fixture = panel.getByLabel(message("workspace.fixture.label"), { exact: true });
  await fixture.selectOption("truss");
  await expectStatus(page, "unsupported");
  await expect(status.getByTestId("analysis-title")).toHaveText(
    message("workspace.analysis.unsupported"),
  );
  await expect(status).toContainText("t1, t2, t3, t4, t5, t6, t7");
  await expect(results).toHaveCount(0);
  // The other two examples are analysed on opening.
  await fixture.selectOption("beam");
  await expectStatus(page, "analysed");
  await expect(reactions).toHaveCount(2);
  await fixture.selectOption("portal");
  await expectStatus(page, "analysed");
  await expect(sumFx).toHaveText(kN("-20.00"));
  expect(problems).toEqual([]);
});

test("/workspace says that the analysis failed when the solver worker cannot be made, and Retry analyses", async ({
  page,
}) => {
  // Every `new Worker(...)` of the page throws while `__blockWorkers` is true.
  await page.addInitScript(() => {
    const scope = window as unknown as { __blockWorkers: boolean; Worker: typeof Worker };
    scope.__blockWorkers = true;
    scope.Worker = new Proxy(scope.Worker, {
      construct(target, args: ConstructorParameters<typeof Worker>) {
        if (scope.__blockWorkers) {
          throw new Error("worker blocked by the test");
        }
        return new target(...args);
      },
    });
  });
  await openViewport(page);
  const status = page.getByTestId("analysis-status");
  const results = page.getByTestId("side-panel").getByTestId("results");
  await expectStatus(page, "failed");
  await expect(status.getByTestId("analysis-title")).toHaveText(
    message("workspace.analysis.failed"),
  );
  await expect(status).toContainText(message("workspace.analysis.failedWorker"));
  await expect(status).toContainText("worker blocked by the test");
  await expect(results).toHaveCount(0);
  const retry = status.getByRole("button", {
    name: message("workspace.analysis.retry"),
    exact: true,
  });
  // Retry while the worker still cannot be made: the failure is shown again.
  await retry.click();
  await expectStatus(page, "failed");
  await expect(results).toHaveCount(0);
  // The worker can be made again: Retry analyses the portal frame.
  await page.evaluate(() => {
    (window as unknown as { __blockWorkers: boolean }).__blockWorkers = false;
  });
  await retry.click();
  await expectStatus(page, "analysed");
  await expect(results.getByTestId("reaction")).toHaveCount(2);
});

test("/workspace gives the two columns selected with Shift-click another section, and deletes them as one step", async ({
  page,
}, testInfo) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  await openViewport(page);
  const viewport = page.getByTestId("viewport");
  const panel = page.getByTestId("side-panel");
  const reactionMy = panel
    .getByTestId("results")
    .locator('[data-testid="reaction"][data-node="n1"] [data-component="my"]');
  const history = (id: string) =>
    viewport.getByRole("button", { name: message(`workspace.history.${id}`), exact: true });
  await expectStatus(page, "analysed");
  const before = (await reactionMy.textContent()) ?? "";
  expect(before).not.toBe("");

  // "Sections and materials": the fixture's section in cm², cm⁴ and mm, which axis is which, and a generic
  // I-section added to the model. A section in use cannot be removed; an unused material can.
  await panel.getByTestId("library-open").click();
  const library = page.getByTestId("library");
  await expect(library).toBeVisible();
  const sections = library.getByTestId("library-sections");
  for (const id of ["area", "iy", "iz", "j", "depthZ", "depthY"]) {
    await expect(sections.locator("thead")).toContainText(message(`workspace.library.${id}`));
  }
  const cell = (table: string, row: string, column: string) =>
    library.locator(`[data-testid="${table}"] tr[data-id="${row}"] td[data-column="${column}"]`);
  // 8.4e-5 m⁴ is 8 400 cm⁴, 5.4e-3 m² is 54 cm², 0.3 m is 300 mm.
  await expect(cell("library-sections", "s1", "Iy")).toHaveText(/^8\s400$/);
  await expect(cell("library-sections", "s1", "A")).toHaveText("54");
  await expect(cell("library-sections", "s1", "depthZ")).toHaveText("300");
  await expect(cell("library-sections", "s1", "members")).toHaveText("3");
  await expect(cell("library-materials", "mat1", "E")).toHaveText("210");
  await expect(cell("library-materials", "mat1", "fy")).toHaveText("355");
  await expect(cell("library-materials", "mat1", "density")).toHaveText(/^7\s850$/);
  await expect(library.getByTestId("library-axes")).toContainText(
    message("workspace.library.axesIy"),
  );
  await expect(library.getByTestId("library-axes")).toContainText(
    message("workspace.library.axesIz"),
  );
  const removeIn = (table: string, row: string) =>
    library.locator(`[data-testid="${table}"] tr[data-id="${row}"]`).getByTestId("library-remove");
  await expect(removeIn("library-sections", "s1")).toBeDisabled();
  await library.getByTestId("library-section-choice").selectOption("I 400x180");
  await library.getByTestId("library-section-add").click();
  // I 400x180 from its dimensions: Iy = 22 640 cm⁴ (four significant digits).
  await expect(cell("library-sections", "s2", "Iy")).toHaveText(/^22\s640$/);
  await expect(cell("library-sections", "s2", "members")).toHaveText("0");
  await expect(removeIn("library-sections", "s2")).toBeEnabled();
  await library.getByTestId("library-material-choice").selectOption("S275");
  await library.getByTestId("library-material-add").click();
  await expect(cell("library-materials", "mat2", "fy")).toHaveText("275");
  await library.screenshot({ path: screenshotPath(testInfo, "smoke-sections") });
  await removeIn("library-materials", "mat2").click();
  await expect(library.locator('[data-testid="library-materials"] tbody tr')).toHaveCount(1);
  await library.getByTestId("library-close").click();
  await expect(library).toHaveCount(0);
  // Nothing in the model uses the new section yet: the analysis has the same answer.
  await expectStatus(page, "analysed");
  await expect(reactionMy).toHaveText(before);

  // Where the middles of the two columns and of the beam are on screen, in the Front view. A drawing tool
  // reports the snapped point under the pointer, which places the pointer near each member; with the Select
  // tool the pointer then moves across the member until the viewport says it is over it.
  await viewport
    .getByRole("button", { name: message("workspace.viewport.viewFront"), exact: true })
    .click();
  await viewport
    .getByRole("button", { name: message("workspace.tools.node"), exact: true })
    .click();
  const nearC1 = await movePointerTo(page, 0, 2);
  const nearC2 = await movePointerTo(page, 6, 2);
  const nearB1 = await movePointerTo(page, 3, 4);
  const inside = await movePointerTo(page, 3, 2);
  await viewport
    .getByRole("button", { name: message("workspace.tools.select"), exact: true })
    .click();
  const surface = page.getByTestId("viewport-surface");
  const over = async (member: string, near: { x: number; y: number }, across: "x" | "y") => {
    for (let offset = 0; offset <= 60; offset += 2) {
      for (const sign of offset === 0 ? [1] : [1, -1]) {
        const at = {
          x: near.x + (across === "x" ? sign * offset : 0),
          y: near.y + (across === "y" ? sign * offset : 0),
        };
        await page.mouse.move(at.x, at.y);
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
        if ((await surface.getAttribute("data-hover")) === `member:${member}`) {
          return at;
        }
      }
    }
    throw new Error(`the pointer did not find member ${member} near ${near.x}, ${near.y}`);
  };
  const c1 = await over("c1", nearC1, "x");
  const c2 = await over("c2", nearC2, "x");
  const b1 = await over("b1", nearB1, "y");
  const shiftClick = async (at: { x: number; y: number }) => {
    await page.keyboard.down("Shift");
    await page.mouse.click(at.x, at.y);
    await page.keyboard.up("Shift");
  };

  // A click selects the first column; a Shift-click adds the second.
  const selection = panel.getByTestId("selection");
  const section = panel.getByTestId("member-section");
  await page.mouse.click(c1.x, c1.y);
  await expect(selection).toHaveAttribute("data-members", "1");
  await expect(selection).toContainText("c1");
  await expect(section).toHaveValue("s1");
  await shiftClick(c2);
  await expect(selection).toHaveAttribute("data-members", "2");
  await expect(selection).toHaveAttribute("data-nodes", "0");
  await expect(panel.getByTestId("selection-count")).toBeVisible();
  await expect(section).toHaveValue("s1");
  await expect(section).toHaveAttribute("data-mixed", "false");
  await expect(panel.getByTestId("member-material")).toHaveValue("mat1");
  await expect(panel.getByTestId("member-roll")).toHaveValue("0");
  await expect(panel.getByTestId("member-length")).toHaveText("4");
  await expect(panel.getByTestId("member-kind")).toHaveText(message("workspace.member.kindFrame"));
  await expect(panel.getByTestId("member-releases")).toHaveText(
    message("workspace.member.releasesNone"),
  );
  await expect(panel.getByTestId("member-unsupported")).toHaveText(
    message("workspace.member.unsupported"),
  );
  // The fields of a single item are not shown for two.
  await expect(panel.getByTestId("member-loads")).toHaveCount(0);

  // The two columns get the new section in one step: the model is analysed again, and the moment at the
  // foot of the first column is another.
  await section.selectOption("s2");
  await expect(section).toHaveValue("s2");
  await expectStatus(page, "analysed");
  await expect(reactionMy).not.toHaveText(before);
  const stiffer = (await reactionMy.textContent()) ?? "";
  expect(numberIn(stiffer, "workspace.loads.valueKNm")).not.toBe(
    numberIn(before, "workspace.loads.valueKNm"),
  );

  // "Colour by section" is off on opening; on, the legend names the two sections in use.
  const colors = viewport.getByTestId("section-colors");
  await expect(colors).toHaveAttribute("data-on", "false");
  await expect(colors.getByTestId("section-legend")).toHaveCount(0);
  await colors.getByTestId("color-by-section").check();
  await expect(colors).toHaveAttribute("data-on", "true");
  const entries = colors.getByTestId("section-legend").locator("li");
  await expect(entries).toHaveCount(2);
  await expect(entries.nth(0)).toHaveAttribute("data-section", "s1");
  await expect(entries.nth(1)).toHaveAttribute("data-section", "s2");
  await expect(entries.nth(1)).toContainText("I 400x180");
  expect(await entries.nth(0).getAttribute("data-color")).not.toBe(
    await entries.nth(1).getAttribute("data-color"),
  );
  // The picture: the two columns selected, with their fields in the Properties section.
  await panel.getByTestId("delete-selection").scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshotPath(testInfo, "smoke-multi-select") });

  // With the beam added, the sections differ: the field says mixed. A second Shift-click takes it out.
  await shiftClick(b1);
  await expect(selection).toHaveAttribute("data-members", "3");
  await expect(section).toHaveAttribute("data-mixed", "true");
  await expect(section).toHaveValue("");
  await expect(section.locator("option:checked")).toHaveText(message("workspace.member.mixed"));
  await shiftClick(b1);
  await expect(selection).toHaveAttribute("data-members", "2");
  await expect(section).toHaveValue("s2");

  // One undo takes the section back from both columns; a redo gives it to both again.
  await history("undo").click();
  await expect(section).toHaveValue("s1");
  await expect(section).toHaveAttribute("data-mixed", "false");
  await expectStatus(page, "analysed");
  await expect(reactionMy).toHaveText(before);
  await history("redo").click();
  await expect(section).toHaveValue("s2");
  await expect(reactionMy).toHaveText(stiffer);

  // Delete removes both columns as one undo step.
  await page.keyboard.press("Delete");
  await expectCounts(page, 4, 1, 2);
  await expect(panel.getByTestId("selection-empty")).toBeVisible();
  await history("undo").click();
  await expectCounts(page, 4, 3, 2);
  await expectStatus(page, "analysed");

  // A click on nothing clears a selection of several items.
  await page.mouse.click(c1.x, c1.y);
  await shiftClick(c2);
  await expect(selection).toHaveAttribute("data-members", "2");
  // While the dialog is open, Delete does not reach the selection behind it, and Escape closes the dialog.
  await panel.getByTestId("library-open").click();
  await expect(library).toBeVisible();
  await library.getByTestId("library-close").focus();
  await page.keyboard.press("Delete");
  await expectCounts(page, 4, 3, 2);
  await page.keyboard.press("Escape");
  await expect(library).toHaveCount(0);
  await expect(selection).toHaveAttribute("data-members", "2");
  await page.mouse.click(inside.x, inside.y);
  await expect(panel.getByTestId("selection-empty")).toBeVisible();
  expect(problems).toEqual([]);
});
