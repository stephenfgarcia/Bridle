# Bridle application image (card P0-02.4): one image, four entrypoints (architecture sections 3, 15, 16).
# `tools/entrypoint.sh` dispatches on its first argument, web | worker | judge | system; every one is a stub
# until P0-02.5 and later cards put the real programs behind the same names.
#
#   docker build --build-arg GIT_SHA=$(git rev-parse --short HEAD) -t bridle:dev .
#   docker run --rm bridle:dev web                          # prints `web <sha>`, exit 0
#   docker run --rm -p 3000:3000 bridle:dev web --serve     # stays up; GET http://127.0.0.1:3000/healthz
#
# Stages:
#   base      node:22.23.4-bookworm-slim, pinned by tag and digest (the only FROM with a tag; bump both together)
#   deps      corepack -> pnpm 12.16.1 (the pin of tools/toolchain.json and package.json's packageManager), the
#             .dockerignore'd context, `pnpm install --frozen-lockfile` from a BuildKit cache mount at
#             /pnpm/store (id bridle-pnpm-store): the store survives across builds, the layer is cached until
#             the context changes
#   build     `turbo run build` (no build task yet; apps/web's lands in P0-02.5), then the prune: a fresh
#             `--prod --ignore-scripts` install from the hot store (an in-place --prod keeps too much)
#   runtime   base again: the manifests, the pruned node_modules, packages, tools/entrypoint.sh, user node;
#             GIT_SHA is the last layer so a new sha re-runs only the lines below it
FROM node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS base

FROM base AS deps
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    DO_NOT_TRACK=1 \
    TURBO_TELEMETRY_DISABLED=1
RUN corepack enable pnpm && corepack install -g pnpm@12.16.1 && pnpm --version
WORKDIR /app
COPY . .
RUN --mount=type=cache,id=bridle-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

FROM deps AS build
RUN pnpm exec turbo run build
RUN --mount=type=cache,id=bridle-pnpm-store,target=/pnpm/store \
    rm -rf node_modules packages/*/node_modules \
    && pnpm install --frozen-lockfile --prod --ignore-scripts --store-dir /pnpm/store \
    && mkdir -p node_modules

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages ./packages
COPY --chmod=755 --chown=node:node tools/entrypoint.sh ./tools/entrypoint.sh
ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA
LABEL org.opencontainers.image.revision=$GIT_SHA \
      org.opencontainers.image.source=https://github.com/stephenfgarcia/Bridle
USER node
EXPOSE 3000
# No curl in the image: node probes the health endpoint every --serve process exposes. Docker honours this
# HEALTHCHECK; ECS ignores image healthchecks (the task definition gets its own in P0-05).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node","-e","require('node:http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]
ENTRYPOINT ["/app/tools/entrypoint.sh"]
