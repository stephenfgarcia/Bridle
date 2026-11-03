#!/usr/bin/env bash
# Bridle application image entrypoint (card P0-02.4): one image, four entrypoints (architecture 3, 15, 16).
#
# usage: entrypoint.sh (web|worker|judge|system) [--serve]
#
#   web | worker | judge | system   prints one line, `<name> <sha>` (GIT_SHA, `unknown` when unset), exit 0
#   --serve                         after that line, stays alive as an HTTP server on 0.0.0.0:$PORT (3000):
#                                   GET /healthz -> 200 application/json {"ok":true,"entrypoint":"<name>","sha":"<sha>"}
#                                   anything else -> 404; logs `<name> <sha> serving /healthz on :<port>`;
#                                   SIGTERM or SIGINT closes the server and exits 0 (so `docker stop` ends with 0)
#   -h | --help                     this usage on stdout, exit 0
#   no name, any other name, or a second argument other than --serve: usage on stderr, exit 2
#
# Environment: GIT_SHA (the Dockerfile's build arg; `unknown` without it), PORT (default 3000).
# Every name is a stub today. The mapping once the apps exist (architecture 4.1, 4.6, 4.7, 4.8):
#   web      node apps/web/server.js           (Next.js standalone; P0-02.5)
#   worker   node apps/worker/dist/worker.js
#   judge    node apps/judge/dist/judge.js
#   system   node apps/system/dist/system.js
# The same /healthz server backs all four so the image's HEALTHCHECK stays honest for every --serve process.
# bash 3.2 syntax: the file runs on the host (`bash tools/entrypoint.sh web`) as well as in the image (bash 5.2).
set -eu

usage() {
  echo "usage: entrypoint.sh (web|worker|judge|system) [--serve]"
}

if [ "$#" -eq 0 ]; then
  usage >&2
  exit 2
fi

name="$1"
case "$name" in
  -h | --help)
    usage
    exit 0
    ;;
  web | worker | judge | system) ;;
  *)
    usage >&2
    exit 2
    ;;
esac

serve=0
if [ "$#" -ge 2 ]; then
  if [ "$#" -eq 2 ] && [ "$2" = "--serve" ]; then
    serve=1
  else
    usage >&2
    exit 2
  fi
fi

sha="${GIT_SHA:-unknown}"
echo "$name $sha"
[ "$serve" -eq 1 ] || exit 0

# The stub server: node:http only, no dependency, PID 1 friendly (handlers for SIGTERM and SIGINT).
exec node -e '
const http = require("node:http");
const [name, sha] = process.argv.slice(1);
const port = Number(process.env.PORT) || 3000;
const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, entrypoint: name, sha }));
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found\n");
});
server.listen(port, "0.0.0.0", () => {
  console.log(`${name} ${sha} serving /healthz on :${port}`);
});
const stop = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
' -- "$name" "$sha"
