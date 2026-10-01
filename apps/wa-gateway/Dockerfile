FROM node:24-bookworm-slim AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @sakani/wa-gateway typecheck

FROM node:24-bookworm-slim AS runner

ENV NODE_ENV=production
ENV WA_GATEWAY_PORT=3001
ENV WA_AUTH_DATA_DIR=/var/lib/sakani-wa
WORKDIR /app/apps/wa-gateway

RUN groupadd --system --gid 1001 gateway \
  && useradd --system --uid 1001 --gid gateway gateway \
  && mkdir -p /var/lib/sakani-wa \
  && chown gateway:gateway /var/lib/sakani-wa

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/wa-gateway/node_modules ./node_modules
COPY --from=builder /app/apps/wa-gateway/package.json ./package.json
COPY --from=builder /app/apps/wa-gateway/src ./src
COPY --from=builder /app/packages/config /app/packages/config
COPY --from=builder /app/packages/logger /app/packages/logger
COPY --from=builder /app/packages/shared /app/packages/shared

USER gateway
EXPOSE 3001

CMD ["./node_modules/.bin/tsx", "src/index.ts"]
