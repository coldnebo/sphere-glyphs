# syntax=docker/dockerfile:1
#
# One image, three targets:
#   base  Node 22 + Python 3.11 with all project dependencies baked in
#   dev   base + interactive tooling; source is bind-mounted at runtime (scripts/dev.sh, devcontainer)
#   test  base + a copy of the source; self-contained, for CI (scripts/test.sh --ci)
#
# Dependencies live in /workspace (node_modules, /opt/venv) and the repo is mounted or copied to
# /workspace/sphere-glyphs. Node resolves packages by walking up parent directories, so the mounted
# source finds /workspace/node_modules without anything being installed into the bind mount.

FROM node:22-bookworm-slim AS base

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV VIRTUAL_ENV=/opt/venv \
    PATH=/opt/venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTEST_ADDOPTS="-p no:cacheprovider"
COPY requirements.txt /tmp/requirements.txt
RUN python3 -m venv /opt/venv && pip install --no-cache-dir -r /tmp/requirements.txt

WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && chown -R node:node /workspace

# Extra system packages go after the slow dependency layers (pip downloads scipy),
# so changing this list doesn't reinstall everything above it.
# fonts: resvg needs a real font to draw captions on contact sheets.
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/sphere-glyphs


FROM base AS dev
RUN apt-get update \
 && apt-get install -y --no-install-recommends git less procps \
 && rm -rf /var/lib/apt/lists/*
USER node
CMD ["bash"]


FROM base AS test
COPY --chown=node:node . .
# the workdir itself was created by root; the tests write into it (the site build makes _site/)
RUN chown node:node .
USER node
CMD ["scripts/run-tests.sh"]
