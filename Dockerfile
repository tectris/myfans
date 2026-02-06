FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./

# Copy package.json files for install
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/database/ ./packages/database/
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Build API (explicit commands - no dts generation needed for API server)
WORKDIR /app/apps/api
RUN npx tsup src/index.ts --format esm --noExternal @myfans/shared --noExternal @myfans/database

# Run
EXPOSE 3001
CMD ["node", "dist/index.js"]
