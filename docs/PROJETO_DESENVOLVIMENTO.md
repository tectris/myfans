# FanDreams — Projeto de Desenvolvimento

> Documento tecnico completo para desenvolvimento da plataforma FanDreams.
> Stack: Next.js 15 + Vercel + Neon (Postgres) + Railway + Bunny Stream + Cloudflare R2
> Arquitetura: API-first, mobile-ready, preparada para app nativo futuro.

---

## 1. ARQUITETURA GERAL

### 1.1 Principios

- **API-first:** Toda logica via REST API separada. Frontend consome API. App futuro consome a mesma API.
- **Mobile-first responsive:** UI pensada para mobile primeiro, adaptada para desktop.
- **PWA-ready:** Service worker, manifest, offline capability desde o MVP.
- **Monorepo com Turborepo:** Web + API + packages compartilhados no mesmo repo.
- **Type-safe end-to-end:** TypeScript em tudo. Schemas Zod compartilhados.

### 1.2 Diagrama de Arquitetura

```
                        +------------------+
                        |   Cloudflare     |
                        |   CDN + WAF      |
                        +--------+---------+
                                 |
                    +------------+------------+
                    |                         |
            +-------+-------+       +--------+--------+
            |  Vercel        |       |  Railway         |
            |  Next.js 15    |       |  API Server      |
            |  (Frontend +   |       |  (Hono/Express)  |
            |   SSR + BFF)   |       |  REST API        |
            +-------+-------+       +--------+--------+
                    |                         |
                    +------------+------------+
                                 |
                    +------------+------------+
                    |                         |
            +-------+-------+       +--------+--------+
            |  Neon           |       |  Upstash Redis   |
            |  PostgreSQL     |       |  Cache + Queue   |
            |  (Primary DB)   |       |  + Rate Limit    |
            +----------------+       +-----------------+

                    +------------+------------+
                    |                         |
            +-------+-------+       +--------+--------+
            |  Cloudflare R2  |       |  Bunny Stream    |
            |  Images + Files |       |  Video + DRM     |
            +----------------+       +-----------------+

            +----------------+       +-----------------+
            |  MercadoPago    |       |  Stream Chat     |
            |  PIX + Cards    |       |  Real-time msg   |
            +----------------+       +-----------------+

            +----------------+
            |  Sightengine    |
            |  Content Mod    |
            +----------------+
```

### 1.3 Por que API separada (Railway) e nao apenas Next.js API Routes?

1. **Limite de 4.5MB body** nas Vercel Serverless Functions — inviavel para uploads
2. **Cold starts** em serverless afetam latencia de API
3. **Long-running processes** (transcoding, webhooks, AI) nao funcionam em serverless
4. **App nativo futuro** precisa de API standalone
5. **Websockets** para real-time (Vercel nao suporta nativamente)
6. Railway permite **persistent server** com Websockets, cron jobs, background workers

---

## 2. ESTRUTURA DO MONOREPO

```
fandreams/
+-- apps/
|   +-- web/                          # Next.js 15 (Vercel)
|   |   +-- app/
|   |   |   +-- (auth)/               # Grupo de rotas publicas
|   |   |   |   +-- login/
|   |   |   |   +-- register/
|   |   |   |   +-- forgot-password/
|   |   |   +-- (platform)/           # Grupo de rotas autenticadas
|   |   |   |   +-- feed/             # Feed principal / discovery
|   |   |   |   +-- explore/          # Explorar criadores
|   |   |   |   +-- creator/
|   |   |   |   |   +-- [username]/   # Perfil publico do criador
|   |   |   |   |   +-- dashboard/    # Dashboard do criador
|   |   |   |   |   +-- analytics/    # Analytics gamificado
|   |   |   |   |   +-- content/      # Gerenciar conteudo
|   |   |   |   |   +-- earnings/     # Financeiro
|   |   |   |   |   +-- settings/     # Config do criador
|   |   |   |   +-- fan/
|   |   |   |   |   +-- subscriptions/  # Minhas assinaturas
|   |   |   |   |   +-- wallet/         # FanCoins wallet
|   |   |   |   |   +-- collections/    # Badges e colecionaveis
|   |   |   |   |   +-- history/        # Historico de compras
|   |   |   |   +-- messages/          # Chat/DMs
|   |   |   |   +-- notifications/     # Central de notificacoes
|   |   |   |   +-- settings/          # Config do usuario
|   |   |   |   +-- battles/           # Fan Battles (lives)
|   |   |   +-- (admin)/              # Painel administrativo
|   |   |   |   +-- dashboard/
|   |   |   |   +-- users/
|   |   |   |   +-- content/
|   |   |   |   +-- finance/
|   |   |   |   +-- moderation/
|   |   |   +-- api/                  # BFF routes (proxy leve)
|   |   |   +-- layout.tsx
|   |   |   +-- page.tsx              # Landing page
|   |   +-- components/
|   |   |   +-- ui/                   # Componentes base (shadcn/ui)
|   |   |   +-- layout/              # Header, Footer, Sidebar, Nav
|   |   |   +-- feed/                # PostCard, FeedList, Stories
|   |   |   +-- creator/             # CreatorCard, CreatorProfile
|   |   |   +-- fan/                 # FanBadge, WalletWidget
|   |   |   +-- gamification/        # StreakCounter, LevelBadge, HypeWave
|   |   |   +-- media/              # VideoPlayer, ImageGallery, Upload
|   |   |   +-- payment/            # SubscribeButton, TipModal, Checkout
|   |   |   +-- chat/               # MessageList, ChatInput, DMThread
|   |   |   +-- battle/             # BattleArena, BattleBar, Timer
|   |   +-- hooks/                   # Custom React hooks
|   |   +-- lib/                     # Utils, API client, constants
|   |   +-- styles/                  # Global styles, theme
|   |   +-- public/                  # Static assets
|   |   +-- next.config.ts
|   |   +-- tailwind.config.ts
|   |   +-- package.json
|   |
|   +-- api/                          # API Server (Railway)
|   |   +-- src/
|   |   |   +-- index.ts             # Entry point (Hono)
|   |   |   +-- routes/
|   |   |   |   +-- auth.ts          # POST /auth/register, /auth/login, etc.
|   |   |   |   +-- users.ts         # GET/PATCH /users/:id
|   |   |   |   +-- creators.ts      # CRUD criadores, verificacao
|   |   |   |   +-- posts.ts         # CRUD posts, feed
|   |   |   |   +-- media.ts         # Upload, presigned URLs
|   |   |   |   +-- subscriptions.ts # Assinar, cancelar, listar
|   |   |   |   +-- payments.ts      # Checkout, webhooks, payouts
|   |   |   |   +-- tips.ts          # Enviar/receber gorjetas
|   |   |   |   +-- fancoins.ts      # Wallet, compra, transferencia
|   |   |   |   +-- gamification.ts  # Streaks, XP, badges, leaderboard
|   |   |   |   +-- messages.ts      # DMs, threads
|   |   |   |   +-- notifications.ts # Push, in-app, email
|   |   |   |   +-- discovery.ts     # Feed algo, search, trending
|   |   |   |   +-- battles.ts       # Criar, participar, votar
|   |   |   |   +-- admin.ts         # Moderacao, reports, analytics
|   |   |   |   +-- webhooks.ts      # Payment provider webhooks
|   |   |   +-- middleware/
|   |   |   |   +-- auth.ts          # JWT validation
|   |   |   |   +-- rateLimit.ts     # Rate limiting via Upstash
|   |   |   |   +-- validation.ts    # Zod schema validation
|   |   |   |   +-- upload.ts        # Multipart handling
|   |   |   |   +-- cors.ts          # CORS config
|   |   |   |   +-- logging.ts       # Request logging
|   |   |   +-- services/
|   |   |   |   +-- auth.service.ts
|   |   |   |   +-- user.service.ts
|   |   |   |   +-- creator.service.ts
|   |   |   |   +-- post.service.ts
|   |   |   |   +-- media.service.ts
|   |   |   |   +-- subscription.service.ts
|   |   |   |   +-- payment.service.ts
|   |   |   |   +-- fancoin.service.ts
|   |   |   |   +-- gamification.service.ts
|   |   |   |   +-- notification.service.ts
|   |   |   |   +-- discovery.service.ts
|   |   |   |   +-- moderation.service.ts
|   |   |   |   +-- battle.service.ts
|   |   |   +-- jobs/                # Background jobs
|   |   |   |   +-- payout.job.ts    # Processar payouts
|   |   |   |   +-- streak.job.ts    # Reset streaks diarios
|   |   |   |   +-- analytics.job.ts # Agregar metricas
|   |   |   |   +-- cleanup.job.ts   # Limpar dados expirados
|   |   |   +-- providers/           # Integracoes externas
|   |   |   |   +-- mercadopago.ts
|   |   |   |   +-- stripe.ts
|   |   |   |   +-- bunny.ts
|   |   |   |   +-- cloudflare-r2.ts
|   |   |   |   +-- sightengine.ts
|   |   |   |   +-- stream-chat.ts
|   |   |   |   +-- email.ts         # Resend ou SendGrid
|   |   |   +-- config/
|   |   |   |   +-- env.ts           # Env vars tipadas
|   |   |   |   +-- database.ts      # Drizzle config
|   |   |   |   +-- redis.ts         # Upstash config
|   |   |   +-- utils/
|   |   +-- drizzle/                 # Migrations
|   |   +-- Dockerfile
|   |   +-- package.json
|
+-- packages/
|   +-- database/                    # Schema Drizzle compartilhado
|   |   +-- schema/
|   |   |   +-- users.ts
|   |   |   +-- creators.ts
|   |   |   +-- posts.ts
|   |   |   +-- media.ts
|   |   |   +-- subscriptions.ts
|   |   |   +-- payments.ts
|   |   |   +-- fancoins.ts
|   |   |   +-- gamification.ts
|   |   |   +-- messages.ts
|   |   |   +-- notifications.ts
|   |   |   +-- battles.ts
|   |   |   +-- reports.ts
|   |   +-- index.ts
|   |   +-- package.json
|   |
|   +-- shared/                      # Types + utils compartilhados
|   |   +-- types/
|   |   |   +-- api.ts              # Request/Response types
|   |   |   +-- user.ts
|   |   |   +-- creator.ts
|   |   |   +-- post.ts
|   |   |   +-- payment.ts
|   |   |   +-- gamification.ts
|   |   +-- validators/             # Zod schemas
|   |   |   +-- auth.ts
|   |   |   +-- user.ts
|   |   |   +-- post.ts
|   |   |   +-- payment.ts
|   |   +-- constants/
|   |   |   +-- gamification.ts     # Niveis, XP thresholds, badges
|   |   |   +-- pricing.ts          # Taxas, limites
|   |   |   +-- permissions.ts      # Roles, capabilities
|   |   +-- utils/
|   |   |   +-- currency.ts
|   |   |   +-- date.ts
|   |   |   +-- slug.ts
|   |   +-- package.json
|   |
|   +-- ui/                          # Design system compartilhado
|   |   +-- components/
|   |   +-- package.json
|
+-- turbo.json                       # Turborepo config
+-- package.json                     # Root package.json
+-- pnpm-workspace.yaml
+-- .env.example
+-- docker-compose.yml               # Dev local (Postgres + Redis)
+-- README.md
```

---

## 3. DATABASE SCHEMA (Drizzle ORM + Neon Postgres)

### 3.1 Core Tables

```sql
-- =============================================
-- USERS & AUTH
-- =============================================

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  username        VARCHAR(50) UNIQUE NOT NULL,
  display_name    VARCHAR(100),
  password_hash   VARCHAR(255) NOT NULL,
  avatar_url      TEXT,
  cover_url       TEXT,
  bio             TEXT,
  role            VARCHAR(20) DEFAULT 'fan',  -- fan, creator, admin
  email_verified  BOOLEAN DEFAULT FALSE,
  is_active       BOOLEAN DEFAULT TRUE,
  date_of_birth   DATE,
  country         VARCHAR(2),                 -- ISO 3166-1 alpha-2
  language        VARCHAR(5) DEFAULT 'pt-BR',
  timezone        VARCHAR(50),
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_settings (
  user_id                UUID PRIMARY KEY REFERENCES users(id),
  notification_email     BOOLEAN DEFAULT TRUE,
  notification_push      BOOLEAN DEFAULT TRUE,
  notification_messages  BOOLEAN DEFAULT TRUE,
  privacy_show_online    BOOLEAN DEFAULT TRUE,
  privacy_show_activity  BOOLEAN DEFAULT TRUE,
  two_factor_enabled     BOOLEAN DEFAULT FALSE,
  two_factor_secret      VARCHAR(255),
  theme                  VARCHAR(10) DEFAULT 'auto', -- light, dark, auto
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CREATOR PROFILES
-- =============================================

CREATE TABLE creator_profiles (
  user_id            UUID PRIMARY KEY REFERENCES users(id),
  category           VARCHAR(50),          -- art, music, fitness, lifestyle, adult, etc.
  tags               TEXT[],               -- array de tags para discovery
  subscription_price DECIMAL(10,2),        -- preco mensal em BRL
  is_verified        BOOLEAN DEFAULT FALSE,
  verification_doc   TEXT,                 -- URL do documento de verificacao
  payout_method      VARCHAR(20),          -- pix, bank_transfer, crypto
  payout_details     JSONB,               -- dados do payout (criptografados)
  commission_rate    DECIMAL(4,2) DEFAULT 12.00, -- taxa da plataforma
  total_earnings     DECIMAL(12,2) DEFAULT 0,
  total_subscribers  INTEGER DEFAULT 0,
  creator_score      DECIMAL(5,2) DEFAULT 0,  -- score gamificado
  is_featured        BOOLEAN DEFAULT FALSE,
  welcome_message    TEXT,                 -- mensagem auto para novos subs
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscription_tiers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  UUID REFERENCES users(id),
  name        VARCHAR(100) NOT NULL,       -- "Bronze", "Gold", "VIP"
  price       DECIMAL(10,2) NOT NULL,      -- preco mensal BRL
  description TEXT,
  benefits    JSONB,                       -- lista de beneficios
  badge_url   TEXT,                        -- badge especial do tier
  max_slots   INTEGER,                     -- limite de vagas (null = ilimitado)
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CONTENT
-- =============================================

CREATE TABLE posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      UUID REFERENCES users(id) NOT NULL,
  content_text    TEXT,
  post_type       VARCHAR(20) DEFAULT 'regular', -- regular, poll, scheduled, ppv
  visibility      VARCHAR(20) DEFAULT 'subscribers', -- public, subscribers, tier_X, ppv
  tier_id         UUID REFERENCES subscription_tiers(id), -- null = all tiers
  ppv_price       DECIMAL(10,2),            -- preco pay-per-view
  is_pinned       BOOLEAN DEFAULT FALSE,
  is_archived     BOOLEAN DEFAULT FALSE,
  like_count      INTEGER DEFAULT 0,
  comment_count   INTEGER DEFAULT 0,
  tip_count       INTEGER DEFAULT 0,
  view_count      INTEGER DEFAULT 0,
  scheduled_at    TIMESTAMPTZ,              -- publicacao agendada
  published_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE post_media (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID REFERENCES posts(id) ON DELETE CASCADE,
  media_type    VARCHAR(10) NOT NULL,  -- image, video, audio
  storage_key   TEXT NOT NULL,         -- R2 key ou Bunny video ID
  thumbnail_url TEXT,
  duration      INTEGER,              -- duracao em segundos (video/audio)
  width         INTEGER,
  height        INTEGER,
  file_size     BIGINT,              -- bytes
  is_preview    BOOLEAN DEFAULT FALSE, -- preview gratuito
  sort_order    INTEGER DEFAULT 0,
  blurhash      VARCHAR(100),         -- placeholder blur
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE post_likes (
  user_id    UUID REFERENCES users(id),
  post_id    UUID REFERENCES posts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE post_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  content     TEXT NOT NULL,
  parent_id   UUID REFERENCES post_comments(id), -- replies
  is_hidden   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE post_bookmarks (
  user_id    UUID REFERENCES users(id),
  post_id    UUID REFERENCES posts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- =============================================
-- SUBSCRIPTIONS & PAYMENTS
-- =============================================

CREATE TABLE subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id              UUID REFERENCES users(id) NOT NULL,
  creator_id          UUID REFERENCES users(id) NOT NULL,
  tier_id             UUID REFERENCES subscription_tiers(id),
  status              VARCHAR(20) DEFAULT 'active', -- active, paused, cancelled, expired
  price_paid          DECIMAL(10,2) NOT NULL,
  currency            VARCHAR(3) DEFAULT 'BRL',
  payment_provider    VARCHAR(20),          -- mercadopago, stripe, ccbill
  provider_sub_id     VARCHAR(255),         -- ID da assinatura no provider
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  auto_renew          BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fan_id, creator_id)               -- 1 sub por criador
);

CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id) NOT NULL,   -- quem pagou
  recipient_id      UUID REFERENCES users(id),             -- quem recebeu
  type              VARCHAR(20) NOT NULL,   -- subscription, tip, ppv, fancoin_purchase
  amount            DECIMAL(10,2) NOT NULL,
  currency          VARCHAR(3) DEFAULT 'BRL',
  platform_fee      DECIMAL(10,2),          -- taxa da plataforma
  creator_amount    DECIMAL(10,2),          -- valor liquido pro criador
  payment_provider  VARCHAR(20),
  provider_tx_id    VARCHAR(255),           -- ID da transacao no provider
  status            VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed, refunded
  metadata          JSONB,                  -- dados extras (post_id, tier_id, etc)
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payouts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      UUID REFERENCES users(id) NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  currency        VARCHAR(3) DEFAULT 'BRL',
  method          VARCHAR(20),             -- pix, bank_transfer
  status          VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  pix_key         VARCHAR(255),
  bank_details    JSONB,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FANCOINS (ECONOMIA INTERNA)
-- =============================================

CREATE TABLE fancoin_wallets (
  user_id    UUID PRIMARY KEY REFERENCES users(id),
  balance    BIGINT DEFAULT 0,             -- saldo em FanCoins (inteiro, sem decimais)
  total_earned   BIGINT DEFAULT 0,         -- total ganho historico
  total_spent    BIGINT DEFAULT 0,         -- total gasto historico
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fancoin_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) NOT NULL,
  type        VARCHAR(30) NOT NULL,        -- purchase, tip, reward_streak, reward_login,
                                           -- reward_engagement, reward_referral, gift_sent,
                                           -- gift_received, ppv_unlock, badge_purchase
  amount      BIGINT NOT NULL,             -- positivo = credito, negativo = debito
  balance_after BIGINT NOT NULL,           -- saldo apos transacao
  reference_id UUID,                       -- ID do post, badge, user, etc.
  description  VARCHAR(255),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- GAMIFICACAO
-- =============================================

CREATE TABLE user_gamification (
  user_id         UUID PRIMARY KEY REFERENCES users(id),
  xp              BIGINT DEFAULT 0,
  level           INTEGER DEFAULT 1,
  current_streak  INTEGER DEFAULT 0,
  longest_streak  INTEGER DEFAULT 0,
  last_active_date DATE,
  fan_tier        VARCHAR(20) DEFAULT 'bronze', -- bronze, silver, gold, diamond, obsidian
  missions_completed INTEGER DEFAULT 0,
  total_badges    INTEGER DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) UNIQUE NOT NULL,  -- early_adopter, streak_30, top_tipper, etc.
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url    TEXT NOT NULL,
  category    VARCHAR(30),                  -- achievement, streak, event, creator, tier
  rarity      VARCHAR(20) DEFAULT 'common', -- common, rare, epic, legendary
  xp_reward   INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_badges (
  user_id    UUID REFERENCES users(id),
  badge_id   UUID REFERENCES badges(id),
  earned_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE daily_missions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(200) NOT NULL,        -- "Comente em 3 posts"
  description TEXT,
  action_type VARCHAR(30),                  -- comment, like, tip, watch, share, login
  target_count INTEGER DEFAULT 1,
  xp_reward   INTEGER DEFAULT 10,
  fancoin_reward INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_mission_progress (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  mission_id  UUID REFERENCES daily_missions(id),
  date        DATE DEFAULT CURRENT_DATE,
  progress    INTEGER DEFAULT 0,
  completed   BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, mission_id, date)
);

CREATE TABLE leaderboard_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  UUID REFERENCES users(id),    -- null = global leaderboard
  user_id     UUID REFERENCES users(id),
  period      VARCHAR(10),                  -- daily, weekly, monthly, alltime
  score       BIGINT DEFAULT 0,
  rank        INTEGER,
  snapshot_date DATE DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MESSAGES (DMs)
-- =============================================

CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID REFERENCES users(id),
  participant_2 UUID REFERENCES users(id),
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  is_locked   BOOLEAN DEFAULT FALSE,       -- requer assinatura para responder
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_1, participant_2)
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  sender_id       UUID REFERENCES users(id),
  content         TEXT,
  media_url       TEXT,
  media_type      VARCHAR(10),              -- text, image, video, audio, tip
  is_ppv          BOOLEAN DEFAULT FALSE,
  ppv_price       DECIMAL(10,2),
  ppv_unlocked_by UUID[],                   -- array de user_ids que desbloquearam
  is_read         BOOLEAN DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- BATTLES (LIVES)
-- =============================================

CREATE TABLE battles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_1_id    UUID REFERENCES users(id),
  creator_2_id    UUID REFERENCES users(id),
  status          VARCHAR(20) DEFAULT 'pending', -- pending, live, completed, cancelled
  winner_id       UUID REFERENCES users(id),
  creator_1_score BIGINT DEFAULT 0,        -- FanCoins recebidos
  creator_2_score BIGINT DEFAULT 0,
  duration_seconds INTEGER DEFAULT 300,     -- 5 minutos padrao
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  replay_url      TEXT,
  viewer_count    INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE battle_tips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id   UUID REFERENCES battles(id),
  fan_id      UUID REFERENCES users(id),
  creator_id  UUID REFERENCES users(id),   -- para qual criador foi o tip
  amount      BIGINT NOT NULL,             -- FanCoins
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MODERATION & REPORTS
-- =============================================

CREATE TABLE reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID REFERENCES users(id),
  target_type  VARCHAR(20),                -- user, post, message, comment
  target_id    UUID,
  reason       VARCHAR(50),                -- spam, harassment, underage, copyright, other
  description  TEXT,
  status       VARCHAR(20) DEFAULT 'pending', -- pending, reviewing, resolved, dismissed
  reviewed_by  UUID REFERENCES users(id),
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE content_moderation_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(20),                -- post, media, message, avatar
  content_id  UUID,
  provider    VARCHAR(20),                 -- sightengine, manual
  result      JSONB,                       -- resultado da analise
  action      VARCHAR(20),                 -- approved, flagged, blocked
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- NOTIFICATIONS
-- =============================================

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  type        VARCHAR(30),                 -- new_sub, new_tip, new_message, new_like,
                                           -- streak_reminder, mission_complete, badge_earned,
                                           -- payout_sent, battle_invite
  title       VARCHAR(200),
  body        TEXT,
  data        JSONB,                       -- metadata (link, IDs, etc)
  is_read     BOOLEAN DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_posts_creator_id ON posts(creator_id);
CREATE INDEX idx_posts_published_at ON posts(published_at DESC);
CREATE INDEX idx_posts_visibility ON posts(visibility);
CREATE INDEX idx_subscriptions_fan_id ON subscriptions(fan_id);
CREATE INDEX idx_subscriptions_creator_id ON subscriptions(creator_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_recipient_id ON payments(recipient_id);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX idx_fancoin_transactions_user_id ON fancoin_transactions(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id, is_read);
CREATE INDEX idx_creator_profiles_category ON creator_profiles(category);
CREATE INDEX idx_creator_profiles_score ON creator_profiles(creator_score DESC);
CREATE INDEX idx_user_gamification_xp ON user_gamification(xp DESC);
CREATE INDEX idx_leaderboard_period ON leaderboard_snapshots(period, snapshot_date, rank);
CREATE INDEX idx_battles_status ON battles(status);
```

---

## 4. API DESIGN (REST)

### 4.1 Framework: Hono

Por que Hono e nao Express:
- 3x mais rapido que Express
- TypeScript-first com inferencia de tipos
- Middleware composable
- Funciona em Node, Cloudflare Workers, Deno, Bun
- Validacao Zod nativa via @hono/zod-validator

### 4.2 Endpoints

#### Auth
```
POST   /api/v1/auth/register          # Cadastro (email + senha)
POST   /api/v1/auth/login             # Login (retorna JWT)
POST   /api/v1/auth/refresh           # Refresh token
POST   /api/v1/auth/forgot-password   # Solicitar reset
POST   /api/v1/auth/reset-password    # Resetar senha
POST   /api/v1/auth/verify-email      # Verificar email
POST   /api/v1/auth/oauth/google      # OAuth Google
POST   /api/v1/auth/oauth/apple       # OAuth Apple
DELETE /api/v1/auth/logout             # Invalidar token
```

#### Users
```
GET    /api/v1/users/me                # Perfil do usuario autenticado
PATCH  /api/v1/users/me                # Atualizar perfil
GET    /api/v1/users/:username         # Perfil publico
DELETE /api/v1/users/me                # Desativar conta
PATCH  /api/v1/users/me/settings       # Atualizar configuracoes
POST   /api/v1/users/me/avatar         # Upload avatar
POST   /api/v1/users/me/cover          # Upload cover
```

#### Creators
```
POST   /api/v1/creators/apply          # Solicitar ser criador
GET    /api/v1/creators/:username      # Perfil do criador
PATCH  /api/v1/creators/me             # Atualizar perfil de criador
GET    /api/v1/creators/me/dashboard   # Dashboard com metricas
GET    /api/v1/creators/me/earnings    # Historico de ganhos
GET    /api/v1/creators/me/subscribers # Lista de assinantes
POST   /api/v1/creators/me/tiers       # Criar tier de assinatura
PATCH  /api/v1/creators/me/tiers/:id   # Atualizar tier
DELETE /api/v1/creators/me/tiers/:id   # Remover tier
POST   /api/v1/creators/me/payout      # Solicitar saque
GET    /api/v1/creators/me/payouts     # Historico de saques
```

#### Posts / Content
```
POST   /api/v1/posts                   # Criar post
GET    /api/v1/posts/:id               # Ver post (verifica acesso)
PATCH  /api/v1/posts/:id               # Editar post
DELETE /api/v1/posts/:id               # Deletar post
GET    /api/v1/posts/:id/comments      # Listar comentarios
POST   /api/v1/posts/:id/comments      # Comentar
POST   /api/v1/posts/:id/like          # Curtir
DELETE /api/v1/posts/:id/like          # Descurtir
POST   /api/v1/posts/:id/bookmark      # Salvar
DELETE /api/v1/posts/:id/bookmark      # Remover dos salvos
POST   /api/v1/posts/:id/tip           # Enviar tip no post
POST   /api/v1/posts/:id/unlock        # Desbloquear PPV
```

#### Media
```
POST   /api/v1/media/upload-url        # Gerar presigned URL para upload
POST   /api/v1/media/upload            # Upload direto (fallback)
GET    /api/v1/media/:id/stream        # URL de streaming com token
DELETE /api/v1/media/:id               # Deletar midia
```

#### Subscriptions
```
POST   /api/v1/subscriptions           # Assinar criador
GET    /api/v1/subscriptions           # Minhas assinaturas
GET    /api/v1/subscriptions/:id       # Detalhes da assinatura
PATCH  /api/v1/subscriptions/:id       # Alterar tier
DELETE /api/v1/subscriptions/:id       # Cancelar
```

#### Payments
```
POST   /api/v1/payments/checkout       # Iniciar checkout
GET    /api/v1/payments/history        # Historico de pagamentos
POST   /api/v1/payments/webhook/mercadopago  # Webhook MP
POST   /api/v1/payments/webhook/stripe       # Webhook Stripe
```

#### FanCoins
```
GET    /api/v1/fancoins/wallet         # Saldo + historico
POST   /api/v1/fancoins/purchase       # Comprar FanCoins
POST   /api/v1/fancoins/tip            # Enviar FanCoins como tip
POST   /api/v1/fancoins/gift           # Enviar presente
GET    /api/v1/fancoins/transactions   # Historico de transacoes
GET    /api/v1/fancoins/packages       # Pacotes disponiveis para compra
```

#### Gamification
```
GET    /api/v1/gamification/me         # Meu XP, level, streaks, badges
GET    /api/v1/gamification/missions   # Missoes do dia
POST   /api/v1/gamification/checkin    # Check-in diario (streak)
GET    /api/v1/gamification/leaderboard?period=weekly&creator_id=X
GET    /api/v1/gamification/badges     # Todos os badges disponiveis
GET    /api/v1/gamification/badges/me  # Meus badges
```

#### Discovery / Feed
```
GET    /api/v1/feed                    # Feed personalizado
GET    /api/v1/feed/following          # Posts de quem eu sigo
GET    /api/v1/discover                # Criadores recomendados
GET    /api/v1/discover/trending       # Trending agora
GET    /api/v1/discover/categories     # Listar categorias
GET    /api/v1/discover/search?q=      # Busca de criadores e conteudo
GET    /api/v1/discover/tags/:tag      # Criadores por tag
```

#### Messages
```
GET    /api/v1/messages                # Listar conversas
GET    /api/v1/messages/:conversationId          # Mensagens da conversa
POST   /api/v1/messages/:conversationId          # Enviar mensagem
POST   /api/v1/messages/:conversationId/read     # Marcar como lida
POST   /api/v1/messages/:id/unlock     # Desbloquear msg PPV
```

#### Battles
```
POST   /api/v1/battles                 # Criar/desafiar
GET    /api/v1/battles/live            # Battles acontecendo agora
GET    /api/v1/battles/:id             # Detalhes da battle
POST   /api/v1/battles/:id/tip        # Enviar tip na battle
GET    /api/v1/battles/:id/replay     # Replay da battle
```

#### Notifications
```
GET    /api/v1/notifications           # Listar notificacoes
PATCH  /api/v1/notifications/:id/read  # Marcar como lida
PATCH  /api/v1/notifications/read-all  # Marcar todas como lidas
DELETE /api/v1/notifications/:id       # Deletar
```

#### Admin
```
GET    /api/v1/admin/dashboard         # Metricas gerais
GET    /api/v1/admin/users             # Listar usuarios
PATCH  /api/v1/admin/users/:id         # Editar/banir usuario
GET    /api/v1/admin/reports            # Reports pendentes
PATCH  /api/v1/admin/reports/:id        # Resolver report
GET    /api/v1/admin/moderation         # Fila de moderacao
GET    /api/v1/admin/payments           # Visao financeira
POST   /api/v1/admin/payouts/process    # Processar payouts em batch
GET    /api/v1/admin/creators/verify    # Fila de verificacao
PATCH  /api/v1/admin/creators/:id/verify # Aprovar/rejeitar criador
```

### 4.3 Autenticacao

```
Strategy: JWT (Access Token + Refresh Token)

Access Token:
  - Expira em 15 minutos
  - Enviado via header: Authorization: Bearer <token>
  - Payload: { sub: userId, role, iat, exp }

Refresh Token:
  - Expira em 30 dias
  - Armazenado em httpOnly cookie (web) ou secure storage (app)
  - Rotacao automatica (cada refresh emite novo par)
  - Armazenado em Redis para invalidacao

Rate Limiting (Upstash):
  - Auth endpoints: 5 req/min por IP
  - API geral: 100 req/min por usuario
  - Upload: 10 req/min por usuario
  - Webhook: 1000 req/min por provider
```

### 4.4 Padrao de Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "hasMore": true
  }
}

{
  "success": false,
  "error": {
    "code": "SUBSCRIPTION_REQUIRED",
    "message": "Voce precisa assinar para ver este conteudo",
    "details": {
      "creator_id": "...",
      "min_tier": "gold"
    }
  }
}
```

---

## 5. FRONTEND — DESIGN & UX

### 5.1 Stack Frontend

| Tecnologia | Funcao |
|---|---|
| Next.js 15 (App Router) | Framework, SSR, routing |
| TypeScript | Type safety |
| Tailwind CSS 4 | Styling utility-first |
| shadcn/ui | Componentes base customizaveis |
| Framer Motion | Animacoes fluidas |
| TanStack Query (React Query) | Data fetching + cache |
| Zustand | State management leve |
| React Hook Form + Zod | Formularios com validacao |
| next-intl | Internacionalizacao (PT-BR, ES, EN) |
| next-pwa | PWA support |

### 5.2 Design System

```
Cores:
  Primary:    #7C3AED (Violet 600) — identidade vibrante
  Secondary:  #EC4899 (Pink 500) — accent
  Background: #0F0F0F (dark mode default)
  Surface:    #1A1A2E
  Text:       #F5F5F5
  Muted:      #8B8B8B

Tipografia:
  Headings: Inter (700, 600)
  Body: Inter (400, 500)
  Monospace: JetBrains Mono (numeros, stats)

Espacamento: escala de 4px (4, 8, 12, 16, 24, 32, 48, 64)

Border radius: 12px (cards), 8px (buttons), 99px (pills/badges)

Dark mode: Default. Light mode como opcao.
```

### 5.3 Paginas Principais

#### Landing Page (nao autenticado)
- Hero com proposta de valor clara: "Crie, compartilhe, monetize. Taxa de apenas 12%"
- Comparativo de taxas vs concorrentes
- Showcase de criadores em destaque
- CTA de registro (criador e fa)
- Social proof (numeros, depoimentos)
- Footer com links, termos, contato

#### Feed Principal
- Layout tipo Instagram Stories no topo (criadores online/recentes)
- Feed infinito de posts dos criadores assinados
- Sidebar com sugestoes de criadores
- Quick actions: like, comment, tip, share
- Media preview com blur para conteudo bloqueado
- Mobile: bottom navigation bar

#### Perfil do Criador
- Cover + Avatar + Bio + Stats (subs, posts, likes)
- Tiers de assinatura com beneficios claros
- Grid de conteudo (fotos/videos)
- Botao de subscribe destacado
- Badge de verificacao
- Social links
- Tab: Posts | Media | Sobre

#### Dashboard do Criador
- Resumo financeiro (hoje, semana, mes)
- Grafico de crescimento de subs
- Creator Score com progresso
- Missoes/challenges ativos
- Ultimas interacoes
- Quick post (upload rapido)

#### Wallet de FanCoins
- Saldo atual (grande, central)
- Botao "Comprar FanCoins" destacado
- Historico de transacoes
- Pacotes de compra com bonus progressivo
- Streak bonus info

#### Gamification Hub
- Nivel atual + barra de XP
- Streak counter com calendario
- Missoes do dia
- Colecao de badges (earned + locked)
- Leaderboard tabs (diario, semanal, mensal)

### 5.4 Navegacao Mobile

```
Bottom Navigation Bar (5 itens):
+------------------------------------------+
|  Home  |  Explore  |  +  |  Chat  |  Me  |
+------------------------------------------+
   feed    discover   post  messages  profile
```

### 5.5 PWA + App Futuro

```
PWA (Fase 1):
  - manifest.json com icones, cores, display: standalone
  - Service worker para cache de assets
  - Push notifications via Web Push API
  - Add to Home Screen prompt
  - Offline page graceful

App Nativo (Fase futura):
  - React Native ou Expo (reutiliza logica TypeScript)
  - Consome a mesma API REST
  - Notificacoes push nativas (FCM/APNS)
  - Biometria para login
  - Upload nativo de camera/galeria
  - Deep linking
```

---

## 6. INTEG RACOES EXTERNAS

### 6.1 Bunny Stream (Video)

```
Fluxo de upload de video:
1. Frontend solicita presigned URL via API
2. API gera URL de upload no Bunny
3. Frontend faz upload direto ao Bunny (nao passa pelo server)
4. Bunny processa: transcoding, thumbnails, DRM
5. Webhook notifica API quando pronto
6. API atualiza post com video_id e thumbnail

Entrega:
- Player com token temporario (URL expira em X minutos)
- Multi-bitrate (adaptativo)
- DRM via MediaCage (Bunny nativo)
- Thumbnails automaticas
- Geoblocking se necessario
```

### 6.2 Cloudflare R2 (Imagens/Arquivos)

```
Fluxo de upload de imagem:
1. API gera presigned PUT URL para R2
2. Frontend faz upload direto ao R2
3. Cloudflare Image Resizing para thumbnails on-the-fly
4. Entrega via Cloudflare CDN (cache global)
5. URLs com token para conteudo pago
```

### 6.3 MercadoPago (PIX)

```
Fluxo de pagamento PIX:
1. Fa clica "Assinar" ou "Comprar FanCoins"
2. API cria Payment no MercadoPago (method: pix)
3. MP retorna QR code + copia-e-cola
4. Fa paga via app do banco
5. Webhook confirma pagamento (<10 segundos)
6. API ativa assinatura / credita FanCoins
7. Notificacao push para fa e criador
```

### 6.4 Sightengine (Moderacao)

```
Moderacao automatica:
1. Upload de imagem/video
2. API envia para Sightengine em background
3. Analise: nudity, violence, minors, drugs, weapons, text
4. Score de confianca retornado
5. Se score > threshold: auto-approve
6. Se score intermediario: fila de moderacao manual
7. Se score critico: auto-block + notificacao admin
```

---

## 7. SEGURANCA

### 7.1 Checklist de Seguranca

| Area | Implementacao |
|---|---|
| Auth | bcrypt (12 rounds), JWT RS256, refresh token rotation |
| CSRF | SameSite cookies + CSRF token |
| XSS | CSP headers, sanitizacao de input (DOMPurify) |
| SQL Injection | Drizzle ORM (parameterized queries) |
| Rate Limiting | Upstash Redis, por IP + por usuario |
| Upload | Validacao de MIME type real (magic bytes), limite de tamanho |
| DRM | Bunny MediaCage para videos, token auth para imagens |
| Watermark | Forensic watermarking com user_id invisivel |
| KYC | Verificacao de identidade para criadores (documento + selfie) |
| Age Verify | Data de nascimento + aceite de termos |
| Encryption | TLS 1.3 everywhere, dados sensiveis criptografados em DB |
| GDPR/LGPD | Consentimento explicito, export de dados, direito ao esquecimento |
| 2FA | TOTP via authenticator app |
| Audit Log | Todas as acoes admin logadas |

### 7.2 Protecao de Conteudo

```
Niveis de protecao:

1. Videos:
   - DRM (Bunny MediaCage)
   - Token auth com expiracao
   - Forensic watermarking (user_id invisivel)
   - Desabilitar download (ofuscacao de URL)
   - Screenshot detection (JS, best-effort)

2. Imagens:
   - Token auth com expiracao
   - Watermark invisivel
   - Right-click disabled (best-effort)
   - Entrega via Cloudflare Worker (nao URL direta)

3. DMCA:
   - Formulario de report
   - Takedown automatico
   - Integracao com servicos de scan (DMCA.com)
   - Counter-notification process
```

---

## 8. DEPLOY & DEVOPS

### 8.1 Ambientes

```
Ambientes:
  development  -> local (docker-compose: Postgres + Redis)
  staging      -> preview (Vercel preview + Railway staging)
  production   -> Vercel + Railway + Neon + Bunny + R2
```

### 8.2 CI/CD

```
GitHub Actions:

on push to main:
  1. Lint (ESLint + Prettier)
  2. Type check (tsc --noEmit)
  3. Unit tests (Vitest)
  4. Build web (Next.js)
  5. Build api (esbuild)
  6. Deploy web -> Vercel (auto via GitHub integration)
  7. Deploy api -> Railway (auto via GitHub integration)
  8. Run migrations -> Neon (via drizzle-kit push)
  9. E2E tests (Playwright, smoke tests)

on pull request:
  1-4 (lint, types, tests, build)
  + Vercel preview deploy
  + Railway preview deploy (se configurado)
```

### 8.3 Monitoramento

| Ferramenta | Funcao | Custo |
|---|---|---|
| Vercel Analytics | Web vitals, performance | Incluso |
| Sentry | Error tracking (web + api) | Free tier |
| BetterStack (Logtail) | Logs centralizados | Free tier |
| UptimeRobot | Health checks + alertas | Free |
| PostHog | Product analytics, feature flags | Free tier |

---

## 9. FASES DE IMPLEMENTACAO

### FASE 1 — MVP Core (Semanas 1-3)

Objetivo: Plataforma funcional com registro, perfis, posts, assinaturas e pagamento via PIX.

```
Semana 1: Fundacao
  [ ] Setup monorepo (Turborepo + pnpm)
  [ ] Setup Next.js 15 + Tailwind + shadcn/ui
  [ ] Setup API Hono + Railway
  [ ] Setup Neon + Drizzle + migrations iniciais
  [ ] Setup Cloudflare R2
  [ ] Auth completo (registro, login, JWT, refresh)
  [ ] Landing page
  [ ] Layout base (header, nav, sidebar)

Semana 2: Core Features
  [ ] CRUD de perfil (fan + creator)
  [ ] Upload de midia (imagens via R2, videos via Bunny)
  [ ] CRUD de posts (texto, imagem, video)
  [ ] Feed basico (posts de criadores assinados)
  [ ] Perfil publico do criador
  [ ] Tiers de assinatura (CRUD)

Semana 3: Monetizacao
  [ ] Integracao MercadoPago (PIX)
  [ ] Fluxo de assinatura completo
  [ ] Pay-per-view (PPV)
  [ ] Tips basico (valor direto em BRL)
  [ ] Dashboard basico do criador (earnings)
  [ ] Webhook de pagamentos
  [ ] Acesso condicional a conteudo (verifica sub)
```

### FASE 2 — Engajamento (Semanas 4-6)

```
Semana 4: Comunicacao + Discovery
  [ ] DMs (mensagens diretas)
  [ ] Notificacoes in-app
  [ ] Discovery: busca, categorias, trending
  [ ] Feed algoritmico (para voce)
  [ ] Comentarios e likes

Semana 5: FanCoins + Gamificacao
  [ ] Wallet de FanCoins
  [ ] Compra de FanCoins (via PIX)
  [ ] Tips com FanCoins
  [ ] Presentes virtuais
  [ ] Sistema de XP + niveis
  [ ] Streaks diarios
  [ ] Badges iniciais (10-20 badges)

Semana 6: Gamificacao Avancada
  [ ] Missoes diarias
  [ ] Leaderboards (por criador + global)
  [ ] Hype Waves
  [ ] Niveis de fa (bronze -> obsidian)
  [ ] Creator Score
  [ ] Challenges para criadores
```

### FASE 3 — Polish + Launch (Semanas 7-8)

```
Semana 7: Seguranca + Moderacao
  [ ] Moderacao automatica (Sightengine)
  [ ] Sistema de reports
  [ ] KYC para criadores (upload documento)
  [ ] DRM para videos (Bunny MediaCage)
  [ ] Watermarking
  [ ] Rate limiting ajustado
  [ ] 2FA

Semana 8: Launch Prep
  [ ] PWA (manifest, service worker)
  [ ] SEO (meta tags, sitemap, robots)
  [ ] Performance optimization (Core Web Vitals)
  [ ] i18n (PT-BR padrao, EN e ES preparados)
  [ ] Testes E2E (Playwright, fluxos criticos)
  [ ] Monitoramento (Sentry, PostHog, logs)
  [ ] Onboarding flow para criadores
  [ ] Onboarding flow para fas
  [ ] Termos de uso + politica de privacidade
  [ ] Soft launch com grupo beta de criadores
```

### FASE 4 — Growth (Pos-launch)

```
  [ ] AI Chatbot para criadores
  [ ] Fan Battles (lives)
  [ ] Processador de pagamento backup (CCBill/Segpay)
  [ ] Multi-currency (USD, EUR)
  [ ] App nativo (React Native / Expo)
  [ ] Programa de referral
  [ ] Marketplace de produtos digitais
  [ ] Agendamento de conteudo
  [ ] Stories/conteudo efemero
  [ ] Integracao com redes sociais (cross-post)
  [ ] Creator Shares (revenue sharing tokenizado)
  [ ] Expansao LATAM (Mexico, Colombia, Argentina)
```

---

## 10. DEPENDENCIAS E PACOTES PRINCIPAIS

```json
{
  "apps/web": {
    "next": "^15.x",
    "react": "^19.x",
    "typescript": "^5.x",
    "tailwindcss": "^4.x",
    "@tanstack/react-query": "^5.x",
    "zustand": "^5.x",
    "framer-motion": "^11.x",
    "react-hook-form": "^7.x",
    "zod": "^3.x",
    "next-intl": "^4.x",
    "next-pwa": "^5.x",
    "date-fns": "^4.x",
    "lucide-react": "latest",
    "sonner": "latest",
    "nuqs": "latest"
  },
  "apps/api": {
    "hono": "^4.x",
    "@hono/node-server": "^1.x",
    "@hono/zod-validator": "latest",
    "drizzle-orm": "latest",
    "@neondatabase/serverless": "latest",
    "@upstash/redis": "latest",
    "@upstash/ratelimit": "latest",
    "mercadopago": "latest",
    "jsonwebtoken": "^9.x",
    "bcryptjs": "^2.x",
    "zod": "^3.x",
    "bullmq": "latest",
    "aws-sdk-v3 (S3 client for R2)": "latest",
    "sharp": "latest",
    "nanoid": "latest"
  },
  "packages/database": {
    "drizzle-orm": "latest",
    "drizzle-kit": "latest"
  }
}
```

---

## 11. ENVIRONMENT VARIABLES

```env
# ==========================================
# DATABASE
# ==========================================
DATABASE_URL=postgresql://user:pass@host/fandreams?sslmode=require

# ==========================================
# REDIS
# ==========================================
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# ==========================================
# AUTH
# ==========================================
JWT_SECRET=...
JWT_REFRESH_SECRET=...
NEXTAUTH_URL=https://fandreams.co

# ==========================================
# CLOUDFLARE R2
# ==========================================
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=fandreams-media
R2_PUBLIC_URL=https://media.fandreams.co

# ==========================================
# BUNNY
# ==========================================
BUNNY_API_KEY=...
BUNNY_LIBRARY_ID=...
BUNNY_CDN_HOSTNAME=...
BUNNY_TOKEN_AUTH_KEY=...

# ==========================================
# MERCADOPAGO
# ==========================================
MERCADOPAGO_ACCESS_TOKEN=...
MERCADOPAGO_PUBLIC_KEY=...
MERCADOPAGO_WEBHOOK_SECRET=...

# ==========================================
# STRIPE (SFW fallback)
# ==========================================
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...

# ==========================================
# SIGHTENGINE (Moderacao)
# ==========================================
SIGHTENGINE_API_USER=...
SIGHTENGINE_API_SECRET=...

# ==========================================
# STREAM CHAT
# ==========================================
STREAM_API_KEY=...
STREAM_API_SECRET=...

# ==========================================
# EMAIL (Resend)
# ==========================================
RESEND_API_KEY=...

# ==========================================
# MONITORING
# ==========================================
SENTRY_DSN=...
POSTHOG_KEY=...
NEXT_PUBLIC_POSTHOG_KEY=...

# ==========================================
# APP
# ==========================================
NODE_ENV=production
API_URL=https://api.fandreams.co
NEXT_PUBLIC_API_URL=https://api.fandreams.co
NEXT_PUBLIC_APP_URL=https://fandreams.co
PLATFORM_FEE_PERCENT=12
FANCOIN_RATE=100
```

---

## 12. CONVENCOES DE CODIGO

```
Linguagem: TypeScript strict mode
Formatacao: Prettier (printWidth: 100, singleQuote: true, semi: false)
Linting: ESLint (flat config, strict rules)
Commits: Conventional Commits (feat:, fix:, chore:, docs:)
Branches: feat/*, fix/*, chore/*
PR: Squash merge para main
Testes: Vitest (unit), Playwright (e2e)
Nomenclatura:
  - Arquivos: kebab-case (user-profile.tsx)
  - Componentes: PascalCase (UserProfile)
  - Functions/vars: camelCase (getUserById)
  - DB columns: snake_case (created_at)
  - API routes: kebab-case (/api/v1/fan-coins)
  - Env vars: UPPER_SNAKE_CASE
  - Types/Interfaces: PascalCase com prefixo I para interfaces de servico
```

---

> Documento gerado em Fevereiro/2026
> Projeto FanDreams — Especificacao Tecnica v1.0
> Pronto para implementacao.
