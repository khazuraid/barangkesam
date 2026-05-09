FROM node:20-slim AS base
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN npm install -g turbo
RUN turbo prune @repo/server --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
RUN npm install

COPY --from=builder /app/out/full/ .
RUN npx turbo run build --filter=@repo/server

FROM base AS runner
WORKDIR /app
COPY --from=installer /app .
EXPOSE 3001
# Jalankan migrasi dan start
CMD ["node", "apps/server/dist/app.js"]
