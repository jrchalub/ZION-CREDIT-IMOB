FROM node:22-alpine AS deps
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://zioncredit:build@127.0.0.1:5432/zion_credit
ENV REDIS_URL=redis://127.0.0.1:6379
ENV AUTH_SECRET=build-time-placeholder-secret-min-32-chars
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
RUN addgroup -S zion && adduser -S zion -G zion

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/pnpm-workspace.yaml ./
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./
COPY --from=build /app/next.config.ts ./
COPY --from=build /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
RUN chmod +x /app/scripts/docker-entrypoint.sh && chown -R zion:zion /app

USER zion
EXPOSE 3000

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["pnpm", "start"]
