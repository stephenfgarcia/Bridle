// The smoke test of apps/web (card P0-02.5; the locale since card P0-02.6; the shell since card PX-02.1; the
// 3D viewport since card PX-02.2; the model store since card PX-02.3; the tools since card PX-02.4; supports and
// loads since card PX-02.5): the health route, then the home page and its screenshot, then the workspace route with the navigation, then the
// viewport with the side panel's counts, the Undo and Redo buttons, the issues and the fixture switch, then
// hovering and selecting a member in the viewport, then a new model with two nodes and a member drawn with
// the Node and the Member tool, then a nodal load placed with the Load tool and a uniform load added to the
// beam of the portal frame from the side panel.
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
