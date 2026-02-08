# Branch Report: claude/fix-feed-user-search-Ej3xm

**Branch:** `claude/fix-feed-user-search-Ej3xm`
**Periodo:** 07/02/2026 - 08/02/2026
**Total de commits:** 32 (22 commits de codigo + 10 merge commits)
**Arquivos modificados:** 54
**Linhas adicionadas:** ~3.775
**Linhas removidas:** ~217

---

## Resumo Executivo

Esta branch concentrou uma grande sprint de features e correções na plataforma MyFans, abrangendo desde infraestrutura de deploy (Docker/Railway) até features de engajamento social (follows, shares, views, notificações). O trabalho foi dividido em múltiplas fases, cada uma construindo sobre a anterior.

---

## Commits (ordem cronológica)

| # | Hash | Tipo | Descrição |
|---|------|------|-----------|
| 1 | `e08ca00` | feat | Add KYC review page in admin dashboard |
| 2 | `1aec845` | feat | Add rate limiting with Upstash Redis |
| 3 | `b7b4205` | feat | Integrate MercadoPago for FanCoin purchases (PIX + credit card) |
| 4 | `657584b` | feat | Add password reset and email verification flows |
| 5 | `8092d27` | fix | Feed shows public posts, header search works, profile image upload |
| 6 | `6f81e08` | chore | Update pnpm-lock.yaml after merge with main |
| 7 | `9c8a0e7` | fix | Wrap useSearchParams in Suspense boundary for Next.js 15 prerendering |
| 8 | `6254d0c` | fix | Search now finds all users, not just creators |
| 9 | `ebd6751` | feat | Tip logs, @username in transactions, notifications, follow & share |
| 10 | `8765154` | fix | Robust tip notifications, aggregate tips, tip logs on creator profile |
| 11 | `640fa0e` | chore | Add version marker to health endpoint for deployment verification |
| 12 | `a6c5717` | fix | Bundle @upstash packages to fix Railway deploy crash |
| 13 | `cfabf14` | fix | Use dynamic imports for @upstash to prevent server crash |
| 14 | `870256b` | fix | Improve Docker build reliability and add deployment verification |
| 15 | `a118d63` | fix | Add root tsconfig.json to Docker and make start.sh resilient |
| 16 | `79a269d` | fix | Use **/node_modules in .dockerignore and add timeout to start.sh |
| 17 | `4ed1125` | fix | Increment tipCount on posts and add toggle visibility to creator page |
| 18 | `d763463` | fix | Start API immediately, run db-push in background |
| 19 | `4d41e63` | fix | Wrap Redis constructor in try/catch to prevent healthcheck 500s |
| 20 | `88d73d0` | feat | Follows system, post stats, native share, linkable @mentions, report |
| 21 | `4680537` | fix | Share modal for desktop, subscribe button, view counts |
| 22 | `5ffcf87` | feat | View tracking, multi-image gallery, lightbox, profile views, admin creator profile |
| 23 | `bc36662` | feat | Anti-manipulation view tracking with deduplication |

*+ 9 merge commits de PRs (#34 a #40) e merge de main*

---

## Features Implementadas

### 1. Painel Admin - Revisao KYC
**Commit:** `e08ca00`
**Arquivos:** `apps/web/src/app/(platform)/admin/kyc/page.tsx`, `apps/api/src/services/admin.service.ts`, `apps/api/src/routes/admin.ts`

- Pagina de revisao de documentos KYC no painel admin
- Listagem de documentos pendentes com preview
- Aprovacao/rejeicao com motivo
- Atualizacao automatica do kycStatus do usuario

### 2. Rate Limiting com Upstash Redis
**Commit:** `1aec845`
**Arquivos:** `apps/api/src/config/redis.ts`, `apps/api/src/middleware/rateLimit.ts`

- Middleware de rate limiting usando Upstash Redis
- Configuracao por rota (auth mais restritivo, API geral mais permissivo)
- Import dinamico com try/catch para evitar crash quando Redis indisponivel

### 3. Pagamentos MercadoPago
**Commit:** `b7b4205`
**Arquivos:** `apps/api/src/services/payment.service.ts`, `apps/api/src/routes/payments.ts`, `apps/web/src/app/(platform)/wallet/page.tsx`

- Integracao MercadoPago para compra de FanCoins
- Suporte a PIX e cartao de credito
- Webhook para confirmacao de pagamento
- UI de compra integrada ao wallet

### 4. Reset de Senha e Verificacao de Email
**Commit:** `657584b`
**Arquivos:** `apps/api/src/services/email.service.ts`, `apps/api/src/services/auth.service.ts`, `apps/web/src/app/forgot-password/page.tsx`, `apps/web/src/app/reset-password/page.tsx`, `apps/web/src/app/verify-email/page.tsx`

- Fluxo completo de "esqueci minha senha" com email de reset
- Verificacao de email apos registro
- Paginas de UI para forgot/reset/verify

### 5. Feed Publico e Busca
**Commits:** `8092d27`, `6254d0c`
**Arquivos:** `apps/api/src/services/post.service.ts`, `apps/api/src/services/discovery.service.ts`, `apps/web/src/components/layout/header.tsx`, `apps/web/src/app/(platform)/explore/page.tsx`

- Feed publico para usuarios nao autenticados (posts com visibility='public')
- Busca no header encontra TODOS os usuarios, nao apenas criadores
- Fix do Suspense boundary no useSearchParams (Next.js 15)
- Upload de imagem de perfil (avatar)

### 6. Sistema de Tips com Logs e @mentions
**Commits:** `ebd6751`, `8765154`, `4ed1125`
**Arquivos:** `apps/api/src/services/fancoin.service.ts`, `apps/api/src/services/notification.service.ts`, `apps/web/src/components/fancoins/fancoin-drawer.tsx`, `apps/web/src/app/(platform)/wallet/page.tsx`

- Log de tip enviado visivel nos posts (tipSent com amount e data)
- @username nas descricoes de transacoes clicaveis (link para perfil)
- Componente `TransactionDescription` que parseia @mentions como links
- Notificacao `tip_received` quando criador recebe tip
- Agregacao de tips (evitar spam de notificacoes)
- Incremento de tipCount nos posts

### 7. Sistema de Notificacoes
**Commit:** `ebd6751`
**Arquivos:** `apps/api/src/services/notification.service.ts`, `apps/api/src/routes/notifications.ts`, `apps/web/src/app/(platform)/notifications/page.tsx`

- Tabela de notificacoes com tipos (tip_received, follow, etc.)
- Endpoints: listar, marcar como lida, marcar todas como lidas
- Pagina de notificacoes com UI e badge de contagem

### 8. Sistema de Follows (separado de Subscriptions)
**Commits:** `88d73d0`, `4680537`
**Arquivos:** `packages/database/schema/follows.ts`, `apps/api/src/services/follow.service.ts`, `apps/api/src/routes/users.ts`, `apps/web/src/app/(platform)/creator/[username]/page.tsx`

- Nova tabela `follows` com composite primary key (followerId, followingId)
- Servico: followUser, unfollowUser, checkFollow, getFollowerCount
- Endpoints: POST/DELETE/GET `/users/:userId/follow`
- Botao "Seguir/Seguindo" separado do "Assinar" no perfil do criador
- Follow = gratuito, Subscribe = acesso a conteudo pago

### 9. Compartilhamento Social
**Commits:** `88d73d0`, `4680537`
**Arquivos:** `apps/web/src/components/feed/post-card.tsx`, `apps/web/src/app/(platform)/creator/[username]/page.tsx`

- Web Share API nativo no mobile (detecta via user agent)
- Modal de compartilhamento no desktop com 8 opcoes:
  - Copiar URL, WhatsApp, Telegram, Twitter/X, Facebook, LinkedIn, Reddit, Email
- Compartilhamento de posts E de perfis
- Incremento de shareCount no banco

### 10. Denuncia de Posts
**Commit:** `88d73d0`
**Arquivos:** `apps/api/src/routes/posts.ts`, `apps/web/src/components/feed/post-card.tsx`

- Endpoint `POST /posts/:id/report` com verificacao de duplicata
- Modal de denuncia com 6 motivos (spam, conteudo inapropriado, assedio, violencia, copyright, outro)
- Opcao "Denunciar" no menu "..." para posts de outros usuarios
- Verificacao ALREADY_REPORTED para evitar duplicatas

### 11. Visibilidade de Posts (Toggle)
**Commit:** `4ed1125`
**Arquivos:** `apps/api/src/services/post.service.ts`, `apps/web/src/app/(platform)/creator/[username]/page.tsx`

- Toggle de visibilidade (ocultar/tornar visivel) no menu "..." do post
- Indicador visual "Post oculto - somente voce pode ver" com opacidade reduzida
- Endpoint `PATCH /posts/:id/toggle-visibility`

### 12. Galeria Multi-Imagem e Lightbox
**Commit:** `5ffcf87`
**Arquivos:** `apps/web/src/components/feed/post-card.tsx`, `apps/web/src/app/(platform)/creator/content/page.tsx`

- Upload de multiplas imagens por post (input com `multiple`)
- Selecao de capa com icone de estrela (reordena para primeira posicao no submit)
- Grid responsivo no feed: 1 imagem (aspect-video), 2 (grid-cols-2), 3+ (grid inteligente)
- Overlay "+N" para posts com mais de 4 imagens
- Lightbox fullscreen com:
  - Navegacao prev/next com setas
  - Indicadores de posicao (dots)
  - Fechar ao clicar no fundo ou no X

### 13. Tracking de Visualizacoes (Posts e Perfis)
**Commits:** `5ffcf87`, `bc36662`
**Arquivos:** `packages/database/schema/views.ts`, `packages/database/schema/users.ts`, `apps/api/src/services/post.service.ts`, `apps/api/src/services/user.service.ts`, `apps/web/src/components/feed/post-card.tsx`, `apps/web/src/components/ui/video-player.tsx`

- Coluna `viewCount` nos posts + coluna `profileViews` nos usuarios
- Endpoint `POST /posts/:id/view` com auth opcional
- Exibicao de views nos posts (icone Eye + contagem)
- Exibicao de views do perfil na pagina do criador

### 14. Anti-Manipulacao de Views (Deduplicacao)
**Commit:** `bc36662`
**Arquivos:** `packages/database/schema/views.ts`, `apps/api/src/services/post.service.ts`, `apps/api/src/services/user.service.ts`, `apps/api/src/routes/posts.ts`, `apps/api/src/routes/users.ts`, `apps/web/src/components/feed/post-card.tsx`

**Tabelas criadas:**
- `post_views`: registra postId, userId, ipAddress, viewedAt
- `profile_view_logs`: registra profileUserId, viewerUserId, ipAddress, viewedAt

**Regras de deduplicacao:**
- Janela de 24 horas: mesmo usuario/IP so conta 1 view por conteudo por dia
- Dedup por userId (autenticado) OU ipAddress (anonimo)
- Views do proprio perfil nao sao contadas
- Videos exigem 3 segundos de reproducao antes de contar
- Timer cancelado se usuario pausar antes dos 3s
- Indices otimizados para consultas de dedup

### 15. Perfil do Criador - Estatisticas
**Commits:** `5ffcf87`, `88d73d0`
**Arquivos:** `apps/api/src/services/user.service.ts`, `apps/web/src/app/(platform)/creator/[username]/page.tsx`

- Total de posts (filtrando arquivados/ocultos)
- Total de seguidores (tabela follows)
- Total de assinantes (creatorProfiles.totalSubscribers)
- Total de visualizacoes do perfil
- Data de registro

---

## Correcoes de Deploy (Railway/Docker)

### Docker e Railway
**Commits:** `870256b`, `a118d63`, `79a269d`, `d763463`
**Arquivos:** `Dockerfile`, `.dockerignore`, `apps/api/start.sh`

- `.dockerignore`: padrao `**/node_modules` para ignorar recursivamente
- `Dockerfile`: separacao de `COPY` para dependencias e source code (evitar cache stale)
- `start.sh`: db-push em background + timeout + API inicia imediatamente
- Root `tsconfig.json` incluido no Docker build
- Healthcheck funcional em `/api/v1/health`

### Upstash Redis
**Commits:** `4d41e63`, `cfabf14`, `a6c5717`
**Arquivos:** `apps/api/src/config/redis.ts`, `apps/api/src/middleware/rateLimit.ts`

- Problema: @upstash/redis crashava quando variaveis nao configuradas
- Solucao: import dinamico com try/catch, fallback graceful
- tsup: bundling dos pacotes @upstash para resolver imports

### Health Endpoint
**Commit:** `640fa0e`
- Adicionado marcador de versao no health endpoint (`2.2.0`)
- Facilita verificacao de deploy

---

## Tabelas de Banco Criadas/Modificadas

### Novas tabelas
| Tabela | Schema | Descricao |
|--------|--------|-----------|
| `follows` | `packages/database/schema/follows.ts` | Sistema de follow (composite PK: followerId + followingId) |
| `post_views` | `packages/database/schema/views.ts` | Log de visualizacoes de posts para dedup |
| `profile_view_logs` | `packages/database/schema/views.ts` | Log de visualizacoes de perfis para dedup |

### Colunas adicionadas
| Tabela | Coluna | Tipo | Descricao |
|--------|--------|------|-----------|
| `posts` | `share_count` | integer | Contador de compartilhamentos |
| `users` | `profile_views` | integer | Contador de visualizacoes do perfil |

---

## Novos Arquivos Criados

### Backend (apps/api)
- `src/config/redis.ts` - Configuracao Upstash Redis
- `src/middleware/rateLimit.ts` - Middleware de rate limiting
- `src/routes/notifications.ts` - Rotas de notificacoes
- `src/routes/payments.ts` - Rotas MercadoPago
- `src/services/email.service.ts` - Servico de envio de emails
- `src/services/follow.service.ts` - Servico de follows
- `src/services/notification.service.ts` - Servico de notificacoes
- `src/services/payment.service.ts` - Servico de pagamentos

### Frontend (apps/web)
- `src/app/(platform)/admin/kyc/page.tsx` - Pagina admin KYC review
- `src/app/(platform)/notifications/page.tsx` - Pagina de notificacoes
- `src/app/forgot-password/page.tsx` - Esqueci minha senha
- `src/app/reset-password/page.tsx` - Redefinir senha
- `src/app/verify-email/page.tsx` - Verificar email

### Database (packages/database)
- `schema/follows.ts` - Tabela follows
- `schema/views.ts` - Tabelas post_views e profile_view_logs

---

## Endpoints de API Adicionados

| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| POST | `/users/:userId/follow` | Sim | Seguir usuario |
| DELETE | `/users/:userId/follow` | Sim | Deixar de seguir |
| GET | `/users/:userId/follow` | Sim | Verificar se segue |
| POST | `/posts/:id/view` | Opcional | Registrar visualizacao (dedup) |
| POST | `/posts/:id/share` | Nao | Registrar compartilhamento |
| POST | `/posts/:id/report` | Sim | Denunciar post |
| PATCH | `/posts/:id/toggle-visibility` | Sim (creator) | Alternar visibilidade |
| GET | `/notifications` | Sim | Listar notificacoes |
| PATCH | `/notifications/:id/read` | Sim | Marcar como lida |
| PATCH | `/notifications/read-all` | Sim | Marcar todas como lidas |
| POST | `/payments/create` | Sim | Criar pagamento MercadoPago |
| POST | `/payments/webhook` | Nao | Webhook MercadoPago |
| POST | `/auth/forgot-password` | Nao | Solicitar reset de senha |
| POST | `/auth/reset-password` | Nao | Redefinir senha |
| GET | `/auth/verify-email` | Nao | Verificar email |
| GET | `/admin/kyc/pending` | Sim (admin) | Listar KYC pendentes |
| PATCH | `/admin/kyc/:id/review` | Sim (admin) | Aprovar/rejeitar KYC |

---

## Componentes Frontend Modificados Significativamente

| Componente | Mudancas |
|------------|----------|
| `post-card.tsx` | +484 linhas: lightbox, share modal, report, view tracking, multi-image grid, tip log |
| `creator/[username]/page.tsx` | +314 linhas: follow/subscribe separados, stats, share modal, avatar/cover upload |
| `wallet/page.tsx` | +193 linhas: MercadoPago integration, @mention links |
| `header.tsx` | +85 linhas: busca por todos usuarios, notification badge |
| `fancoin-drawer.tsx` | +29 linhas: @mention links em transacoes |
| `video-player.tsx` | +6 linhas: onPlay/onPause props |

---

## Decisoes Tecnicas

1. **Follow vs Subscribe**: Sistemas separados. Follow e gratuito (tabela `follows`), Subscribe desbloqueia conteudo pago (tabela `subscriptions`).

2. **View deduplication**: Janela de 24h por usuario/IP em vez de lifetime para balancear precisao vs crescimento de tabela. Indices otimizados para queries frequentes.

3. **Video view threshold**: 3 segundos de reproducao minima, inspirado no Instagram (3s) como compromisso entre YouTube (30s) e TikTok (~1s).

4. **Profile view tracking**: Fire-and-forget com `.then().catch()` para nao bloquear a resposta da API. Own profile views ignoradas.

5. **Share detection**: User agent para detectar mobile (`/Mobi|Android/i`) e usar Web Share API nativo. Desktop abre modal com opcoes sociais.

6. **Upstash Redis**: Import dinamico com try/catch para permitir que a API funcione mesmo sem Redis configurado (graceful degradation).

7. **Admin creator profile**: `create-admin.ts` agora cria entrada em `creator_profiles` para o admin, garantindo que botao "Assinar" apareca no perfil.

---

*Relatorio gerado em 08/02/2026*
*Branch: claude/fix-feed-user-search-Ej3xm*
*Ultimo commit: bc36662 (feat: anti-manipulation view tracking with deduplication)*
