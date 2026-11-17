import { execFileSync } from "node:child_process";

const SHA = /^[0-9a-f]{7,40}$/;

/**
 * The git sha the page and the health route report: `GIT_SHA` when it is set and not empty (the image sets
 * it), else `git rev-parse --short HEAD` (development and the smoke test, where git exists), else `unknown`.
 * Read at every call and never cached, so a dev server follows HEAD.
 */
export function gitSha(): string {
  const fromEnv = process.env.GIT_SHA?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  try {
    const out = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).trim();
    if (SHA.test(out)) {
      return out;
    }
  } catch {
    // No git, no repository, or the timeout: the sha is unknown.
  }
  return "unknown";
}
