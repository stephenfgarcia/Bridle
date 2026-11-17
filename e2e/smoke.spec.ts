// The smoke test of apps/web (card P0-02.5): the health route, then the page and its screenshot.
// The health test is first: when a foreign process holds the port, its failure names the cause.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const NOTICE =
  "Educational use only. Not for construction, permitting, or professional engineering use. Results are not a substitute for analysis and design by a licensed engineer.";

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
  await expect(page.locator("h1")).toHaveText("Bridle");
  await expect(page.getByTestId("sha")).toHaveText(expectedSha());
  await expect(page.getByTestId("notice")).toHaveText(NOTICE);
  // config.rootDir is e2e and the root package is not an ES module (no import.meta): the repository root is
  // the directory of the configuration file (configFile is typed optional: without it, the parent of e2e).
  const { configFile, rootDir } = testInfo.config;
  const root = path.dirname(configFile ?? rootDir);
  await page.screenshot({
    path: path.join(root, ".bridle", "screenshots", "smoke-home.png"),
    fullPage: true,
  });
});
