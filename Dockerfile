# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base

# Native PTY and all nine editor languages use the same Debian runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       bash build-essential ca-certificates curl git locales \
       python3 python3-pip python3-venv perl rustc cargo golang-go \
    && sed -i 's/^# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen \
    && locale-gen \
    && rm -rf /var/lib/apt/lists/*

ARG PNPM_VERSION=10.26.1
# Optional CA supports managed proxy environments without baking a session CA into the image.
RUN --mount=type=secret,id=proxy_ca,required=false \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm install --global "pnpm@${PNPM_VERSION}"

WORKDIR /app

FROM base AS build
COPY . .
RUN --mount=type=cache,target=/pnpm/store \
    --mount=type=secret,id=proxy_ca,required=false \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    pnpm install --frozen-lockfile --store-dir /pnpm/store
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/data \
    WORKSPACE_ROOT=/data/workspace \
    LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    SHELL=/bin/bash
ENV PATH="/app/artifacts/api-server/node_modules/.bin:/app/node_modules/.bin:/home/node/.local/bin:${PATH}"
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /data/workspace /data/storage \
    && chown -R node:node /data /home/node
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=3 CMD ["node", "scripts/healthcheck.mjs"]
CMD ["node", "scripts/start.mjs"]
