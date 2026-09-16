# The operations console, as a container: a static Vite bundle served by unprivileged nginx.
#
# ── ONE IMAGE, ANY API ───────────────────────────────────────────────────────────────────────────
# Four settings (API URL, app name, tenant header, Sham Cash bench) are read at container START from
# the environment, through a generated /config.js — see docker/40-runtime-config.sh and
# deploy/docs/CONTRACT.md section 5. So the same `sha-<commit>` image runs on a laptop and on the VPS.
#
# ── THE MOCK BACKEND STAYS A BUILD-TIME DECISION, AND THIS BUILD SAYS NO ─────────────────────────
# `src/main.tsx` refuses to boot a production bundle with the in-browser mock API (which signs anyone
# in as SUPER_ADMIN with a fixed code) unless a second build-time key is set. This file sets
# VITE_ENABLE_MOCKS=false explicitly and never sets VITE_ALLOW_MOCKS_IN_BUILD; neither can be changed
# at runtime.
#
# Build:  docker build -t ghcr.io/mostafahasan1995/cashier-dashboard:local .
# Run:    docker run --rm -p 8080:8080 -e API_BASE_URL=http://api.localhost ghcr.io/mostafahasan1995/cashier-dashboard:local

# ---------- build ----------
# Exact Node release and digest: a rebuild of the same commit uses the same toolchain. The Debian
# (glibc) variant rather than Alpine because the build tools (rolldown, lightningcss, tailwind's
# oxide) ship prebuilt native binaries and the glibc ones are the most exercised.
FROM node:22.23.2-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS build
WORKDIR /app

# Dependencies first, on their own layer, so a source-only change does not reinstall them.
# `npm ci` installs exactly the committed lockfile and fails if package.json disagrees with it.
# The cache mount keeps npm's downloaded tarballs between builds on the same machine (never in the
# image), so a lockfile change re-downloads only what changed. A fresh CI runner starts empty, so the
# result there is identical.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci --no-audit --no-fund

COPY . .

# Explicit, not merely absent: this is the value the production bundle is built with.
ENV VITE_ENABLE_MOCKS=false

# Belt and braces for the one misconfiguration that matters most. .dockerignore already keeps every
# .env file out of the build context (Vite would read them), and VITE_ALLOW_MOCKS_IN_BUILD is not a
# declared build ARG — but if either ever slips in, stop here rather than ship it.
RUN if [ -n "${VITE_ALLOW_MOCKS_IN_BUILD:-}" ]; then \
      echo "VITE_ALLOW_MOCKS_IN_BUILD must never be set for an image build" >&2; exit 1; \
    fi; \
    if ls -A .env* >/dev/null 2>&1; then \
      echo ".env files reached the build context; check .dockerignore" >&2; exit 1; \
    fi

# `npm run build` is `tsc --noEmit && vite build`: a type error fails the image build.
RUN npm run build

# Remove what production must not serve:
#   config.js             the dev placeholder. nginx serves the generated one; if that rule ever broke,
#                         a 404 is honest where an empty placeholder would look like a working config.
#   mockServiceWorker.js  the mock API's service worker. Inert without the mock flag, and not needed.
RUN rm -f dist/config.js dist/mockServiceWorker.js

# ---------- runtime ----------
# nginx-unprivileged runs as uid 101 and listens on 8080. Exact nginx + Alpine release, and digest.
FROM nginxinc/nginx-unprivileged:1.30.4-alpine3.24@sha256:442753882674b49ae2c1de83ed67896131c0777f56df5005e356e62bc3f7e7ce AS runtime

# Root only for these file operations; the final USER line drops back.
USER root
RUN rm -rf /usr/share/nginx/html/*

# Configuration and the start-up hook are owned by root and read-only to the nginx user: the running
# process can read them but cannot rewrite them.
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/default.conf /etc/nginx/conf.d/default.conf
COPY --chmod=0755 docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build /app/dist /usr/share/nginx/html

USER 101

# Documented defaults. API_BASE_URL has none on purpose: the container refuses to start without it.
ENV APP_NAME="" \
    TENANT_HEADER_ENABLED=false \
    ENABLE_SHAMCASH_DEV=false

EXPOSE 8080

# Unlike the backend image (where a HEALTHCHECK would wrongly apply to the HTTP-less worker), this
# image has one role, so a built-in check is safe. Compose defines the same check explicitly.
# busybox wget is in the base image; there is no curl.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

ARG GIT_SHA=unknown
ARG SOURCE_URL=https://github.com/mostafahasan1995/manager-account-dashboard
LABEL org.opencontainers.image.source="${SOURCE_URL}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.title="cashier-dashboard"

# ENTRYPOINT (/docker-entrypoint.sh, which runs /docker-entrypoint.d/*) and CMD (nginx in the
# foreground) are inherited from the base image, as is STOPSIGNAL SIGQUIT for a graceful shutdown.
