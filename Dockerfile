# syntax=docker/dockerfile:1
FROM oven/bun:1.4.0-alpine@sha256:07235578f79ef8c6f97d94aee7938e76f5cdba5f21ae5dbfdd3d3d38058437eb AS build

WORKDIR /app
COPY package.json bun.lock bunfig.toml tsconfig.json ./
COPY apps/client/package.json apps/client/
COPY apps/server/package.json apps/server/
COPY packages/protocol/package.json packages/protocol/
RUN bun install --frozen-lockfile

COPY apps/client apps/client
COPY apps/server apps/server
COPY packages/protocol packages/protocol
RUN bun run build

FROM oven/bun:1.4.0-alpine@sha256:07235578f79ef8c6f97d94aee7938e76f5cdba5f21ae5dbfdd3d3d38058437eb AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    API_PORT=3000

COPY package.json bun.lock bunfig.toml ./
COPY apps/server/package.json apps/server/
COPY packages/protocol/package.json packages/protocol/
# @dormouse/protocol resolves through the copied packages/protocol workspace.
RUN bun install --frozen-lockfile --production

COPY --from=build /app/apps/server/src apps/server/src
COPY --from=build /app/packages/protocol/src packages/protocol/src
COPY --from=build /app/apps/client/dist apps/client/dist

USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e 'const response = await fetch("http://127.0.0.1:3000/health"); if (!response.ok) process.exit(1)'
CMD ["bun", "run", "--cwd", "apps/server", "start"]
