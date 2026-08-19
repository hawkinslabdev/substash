# Build stage
FROM node:24-alpine AS build
ARG BUILD_VERSION
ENV VITE_APP_VERSION=${BUILD_VERSION}

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN mkdir -p migrations
RUN npm rebuild better-sqlite3
RUN npm run build

RUN npm prune --omit=dev --omit=optional

# Runtime stage
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV DB_PATH=/app/data/substash.db

RUN mkdir -p /app/data /app/uploads && chown -R node:node /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server.mjs ./
COPY --from=build --chown=node:node /app/migrations ./migrations
COPY --from=build --chown=node:node /app/package.json ./

USER node
EXPOSE 9456
ENTRYPOINT ["node", "server.mjs"]
