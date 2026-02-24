# Dockerfile for the Web Application - v2 (Simplified)

# ---- Base ----
# Sets up Node.js and pnpm.
FROM node:20 AS base
RUN npm install -g pnpm
WORKDIR /usr/src/app

# ---- Dependencies ----
# Install ALL dependencies in a single layer, including devDependencies.
# This layer is cached as long as package files don't change.
FROM base AS dependencies
COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY src/package.json ./src/
COPY web/package.json ./web/
RUN CI=true pnpm install --frozen-lockfile

# ---- Development ----
# Installs all dependencies and sets up for hot-reloading.
FROM dependencies AS development
USER root
RUN apt-get update && apt-get install -y --no-install-recommends gosu && \
    rm -rf /var/lib/apt/lists/*
# Copy entrypoint script and grant execution rights
COPY --chown=node:node ./docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set the entrypoint to our script
ENTRYPOINT ["docker-entrypoint.sh"]

# Set the working directory for the web app
WORKDIR /usr/src/app/web

# The command to run the development server
CMD ["pnpm", "dev"]

# ---- Final Production Image ----
# Build the application and prune dev dependencies.
FROM dependencies AS production
# Copy all source code from the host machine first
COPY --chown=node:node . .

USER root
# Install any runtime OS packages here if needed (e.g., openssl for Prisma)
RUN apt-get update && apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*
# The 'dependencies' stage ran as root, so node_modules is root-owned.
# We need to change ownership to the node user so it can be modified.
RUN chown -R node:node /usr/src/app

# Switch to the non-root user
USER node

# The node_modules are already here from the 'dependencies' stage.
# Now, we can build and generate code.

# 1. Generate Prisma Client
RUN pnpm exec prisma generate

# Accept build arguments for client-side environment variables
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST

# 2. Build the Next.js application
RUN pnpm --filter web run build

# 3. Prune dev dependencies to create a lean, production-only node_modules
# RUN CI=true pnpm prune --prod # This command is broken and removes 'next'

EXPOSE 3000
WORKDIR /usr/src/app/web
CMD ["/bin/sh", "-c", "npx prisma migrate deploy && pnpm start"]