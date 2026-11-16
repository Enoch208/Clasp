FROM node:22-bookworm-slim AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /clasp
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/server ./apps/server
COPY apps/relay ./apps/relay
RUN pnpm install --frozen-lockfile --filter "@clasp/server..." --filter "@clasp/relay..."

FROM node:22-bookworm-slim
WORKDIR /clasp
COPY --from=deps /clasp /clasp
ENV NODE_ENV=production
EXPOSE 8787 8790
CMD ["apps/server/node_modules/.bin/tsx", "apps/server/src/main.ts"]
