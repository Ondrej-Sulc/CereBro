# Dockerfile for the Bot Application

# ---- Base ----
# Sets up Node.js, pnpm, and the basic monorepo structure.
FROM node:20 AS base
RUN npm install -g pnpm
WORKDIR /usr/src/app

# ---- Dependencies ----
# Creates a layer with all monorepo dependencies installed.
FROM base AS dependencies
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY src/package.json ./src/
COPY web/package.json ./web/
RUN pnpm install --frozen-lockfile

# ---- Builder ----
# A stage that includes source code and can be used for development or production builds.
FROM dependencies AS builder
USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*
# Create assets directory and set permissions before switching user
RUN mkdir -p /usr/src/app/assets/fonts && \
    chown -R node:node /usr/src/app
USER node
# Now that the directory exists and has correct ownership, copy code and download fonts
COPY --chown=node:node . .
RUN curl -L -o assets/fonts/BebasNeue-Regular.ttf https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bebasneue/BebasNeue-Regular.ttf && \
    curl -L -o assets/fonts/BebasNeue-Regular.woff2 https://fonts.gstatic.com/s/bebasneue/v10/JTUSjIg69CK48gW7PXoo9Wlhyw.woff2
RUN pnpm exec prisma generate

# ---- Development ----
# This stage is for local development with hot-reloading.
FROM builder AS development
CMD ["/bin/sh", "-c", "pnpm run dev"]

# ---- Production Builder ----
# This stage builds the app and manually constructs a clean production directory.
FROM builder AS production-builder
# 1. Build the typescript code
RUN pnpm run build
# 2. Manually create the deployment directory
RUN mkdir -p /usr/src/app/deploy
# 3. Copy necessary assets, build output, and dependencies
WORKDIR /usr/src/app
RUN cp -r ./dist ./deploy/dist && \
    cp ./src/package.json ./deploy/package.json && \
    cp -r ./assets ./deploy/assets && \
    cp -r ./node_modules ./deploy/node_modules && \
    cp -r ./prisma ./deploy/prisma && \
    mkdir -p ./deploy/src/data && \
    cp ./src/data/commands.json ./deploy/src/data/commands.json

# ---- Final Production Image ----
FROM base AS production
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core \
    fonts-noto-color-emoji \
    openssl \
    && rm -rf /var/lib/apt/lists/*
USER node
WORKDIR /usr/src/app
COPY --chown=node:node --from=production-builder /usr/src/app/deploy .
CMD ["/bin/sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
