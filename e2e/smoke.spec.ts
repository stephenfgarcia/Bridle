// The smoke test of apps/web (card P0-02.5; the locale since card P0-02.6): the health route, then the page
// and its screenshot.
// The health test is first: when a foreign process holds the port, its failure names the cause.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

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
  // config.rootDir is e2e and the root package is not an ES module (no import.meta): the repository root is
  // the directory of the configuration file (configFile is typed optional: without it, the parent of e2e).
  const { configFile, rootDir } = testInfo.config;
  const root = path.dirname(configFile ?? rootDir);
  await page.screenshot({
    path: path.join(
      root,
      ".bridle",
      "screenshots",
      LOCALE === "en" ? "smoke-home.png" : `smoke-home-${LOCALE}.png`,
    ),
    fullPage: true,
  });
});
