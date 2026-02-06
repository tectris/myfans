FROM node:22-slim
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy everything (simpler, avoids cache issues)
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Force no cache on build step
ARG CACHEBUST=1

# Build API with workspace packages bundled inline
WORKDIR /app/apps/api
RUN npx tsup

# Verify the bundle doesn't reference shared package at runtime
RUN node -e "const fs=require('fs');const f=fs.readFileSync('dist/index.js','utf8');if(f.includes('@myfans/shared')){console.error('ERROR: bundle still references @myfans/shared');process.exit(1)}else{console.log('OK: workspace packages bundled inline')}"

EXPOSE 3001
CMD ["sh", "-c", "npx tsx src/scripts/db-push.ts && node dist/index.js"]
