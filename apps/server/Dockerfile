FROM node:20-slim AS base
RUN corepack enable && apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

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
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# Pastikan folder uploads ada dan bisa ditulisi
RUN mkdir -p apps/server/uploads

# Generate Prisma Client specifically for the target OS
RUN npx turbo run db:generate --filter=@repo/server

FROM base AS runner
WORKDIR /app
COPY --from=installer /app .
EXPOSE 3001
# Jalankan langsung dari source menggunakan tsx agar monorepo terhubung dengan benar
CMD ["npx", "tsx", "apps/server/src/app.ts"]
