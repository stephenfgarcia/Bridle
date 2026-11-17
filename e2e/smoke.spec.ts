// The smoke test of apps/web (card P0-02.5; the locale since card P0-02.6; the shell since card PX-02.1; the
// 3D viewport since card PX-02.2; the model store since card PX-02.3): the health route, then the home page and
// its screenshot, then the workspace route with the navigation, then the viewport with the side panel's counts,
// the Undo and Redo buttons, the issues and the fixture switch, then hovering and selecting a member in the
// viewport.
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
