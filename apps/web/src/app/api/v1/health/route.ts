import { gitSha } from "../../../../sha";

// The sha is read at request time (GIT_SHA is set when the server starts, not when it is built).
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({ ok: true, sha: gitSha() });
}
