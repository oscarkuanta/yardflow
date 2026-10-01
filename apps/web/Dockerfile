FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web ./apps/web

RUN npm ci --ignore-scripts
RUN npm run build -w @yardflow/web

FROM nginx:1.27-alpine

ENV API_UPSTREAM=http://api:4000
ENV PORT=80

COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
