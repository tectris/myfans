# FanDreams

Plataforma de monetizacao para criadores de conteudo com a menor taxa do mercado (12%), gamificacao profunda e FanCoins.

## Stack

- **Frontend:** Next.js 15 (App Router) + React 19 + Tailwind CSS 4
- **API:** Hono 4 (Node.js)
- **Database:** Drizzle ORM + Neon PostgreSQL
- **Monorepo:** Turborepo + pnpm workspaces

## Estrutura

```
fandreams/
├── apps/
│   ├── web/          # Next.js 15 (Vercel)
│   └── api/          # Hono API (Railway)
├── packages/
│   ├── database/     # Drizzle schema
│   └── shared/       # Types, validators, constants
└── docs/             # Estudo estrategico + Projeto
```

## Setup

```bash
pnpm install
cp .env.example .env
# Configure as vars de ambiente

# Dev
pnpm dev

# Build
pnpm build
```

## Licenca

Proprietario. Todos os direitos reservados.
