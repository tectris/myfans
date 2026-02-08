FROM node:22-slim
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace config and package.json files first (for dependency caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies (cached unless package.json/lockfile change)
RUN pnpm install --frozen-lockfile

# Copy source code (invalidates cache when source changes)
COPY packages/database/ ./packages/database/
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Build API with workspace packages bundled inline
WORKDIR /app/apps/api
RUN npx tsup

# Verify the bundle is correct
RUN node -e "const fs=require('fs');const f=fs.readFileSync('dist/index.js','utf8');if(f.includes('@fandreams/shared')){console.error('ERROR: bundle still references @fandreams/shared');process.exit(1)}else{console.log('OK: workspace packages bundled inline')}"
RUN node -e "const fs=require('fs');const f=fs.readFileSync('dist/index.js','utf8');if(!f.includes('notifications')){console.error('ERROR: notifications route missing from bundle');process.exit(1)}else{console.log('OK: notifications route present in bundle')}"
RUN node -e "const fs=require('fs');const f=fs.readFileSync('dist/index.js','utf8');if(!f.includes('2.4.0')){console.error('ERROR: version 2.4.0 not found in bundle');process.exit(1)}else{console.log('OK: version 2.4.0 present in bundle')}"

EXPOSE 3001
ENV NODE_ENV=production
CMD ["sh", "start.sh"]
