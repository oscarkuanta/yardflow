FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/prisma ./apps/api/prisma

RUN npm ci --workspace @yardflow/api --workspace @yardflow/shared --include-workspace-root=false

COPY apps/api ./apps/api

ENV NODE_ENV=production
ENV PORT=4000
ENV TZ=Europe/Berlin

WORKDIR /app/apps/api
EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=10 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "docker-start.sh"]
