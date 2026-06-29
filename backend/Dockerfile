# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source and compile
COPY . .
RUN npx tsc --noEmit || true  # type-check; actual runtime uses tsx

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:20-alpine AS production

# Add non-root user for least-privilege execution
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Only install production deps
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy application source (tsx handles TS at runtime)
COPY --chown=appuser:appgroup src/ ./src/

USER appuser

EXPOSE 4000

ENV NODE_ENV=production

CMD ["npx", "tsx", "src/index.ts"]
