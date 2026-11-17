// The smoke test of apps/web (card P0-02.5; the locale since card P0-02.6; the shell since card PX-02.1): the
// health route, then the home page and its screenshot, then the workspace route with the navigation.
// The health test is first: when a foreign process holds the port, its failure names the cause.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type TestInfo, test } from "@playwright/test";

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

test("/workspace shows the navigation, the viewport area and the side panel", async ({
  page,
}, testInfo) => {
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
  // The viewport of the Desktop Chrome device is 1280 by 720: the laptop screen the shell is laid out for.
  await page.screenshot({ path: screenshotPath(testInfo, "smoke-workspace") });
});
