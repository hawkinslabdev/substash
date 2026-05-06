# Build stage
FROM node:22-slim AS build
ARG BUILD_VERSION
ENV VITE_APP_VERSION=${BUILD_VERSION}

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN mkdir -p migrations
RUN npm rebuild better-sqlite3
RUN npm run build

# Runtime stage
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV DB_PATH=/app/data/substash.db

RUN mkdir -p /app/data /app/uploads && chown -R node:node /app

# Copy node_modules with dev deps for migration, then prune after
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server.mjs ./
COPY --from=build --chown=node:node /app/drizzle.config.ts ./
COPY --from=build --chown=node:node /app/migrations ./migrations
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/package.json ./

# Run migrations as node user, then prune dev dependencies
USER node
RUN npx tsx scripts/migrate.ts && npm prune --omit=dev

EXPOSE 9456
ENTRYPOINT ["node", "server.mjs"]
