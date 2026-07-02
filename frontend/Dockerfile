# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source and build static assets
COPY . .
RUN npm run build

# ── Stage 2: production image (nginx) ────────────────────────────────────────
FROM nginx:1.27-alpine AS production

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy static build output
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config (non-root port 8080)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Run as non-root
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
