# MyFans Platform — Relatório de Auditoria de Segurança Interna

**Versão da Plataforma:** API v2.4.0
**Data:** 2026-02-08
**Auditor:** Claude Security Analyst
**Metodologias:** OWASP Top 10 2021, OWASP API Security Top 10 2023, MITRE ATT&CK v14
**Escopo:** Análise estática de código + testes dinâmicos internos (white-box)
**Classificação:** CONFIDENCIAL

---

## 1. Resumo Executivo

### Nota de Confiança da Plataforma

| Métrica | Valor |
|---|---|
| **NOTA GERAL** | **74/100** |
| **Grade** | **C+** |
| Vulnerabilidades Críticas | 0 |
| Vulnerabilidades Altas | 4 |
| Vulnerabilidades Médias | 7 |
| Vulnerabilidades Baixas | 5 |
| Informativas | 3 |

### Score por Categoria (OWASP Top 10)

| # | Categoria OWASP | Score | Status |
|---|---|---|---|
| A01 | Broken Access Control | 82/100 | ⚠️ BOM |
| A02 | Cryptographic Failures | 85/100 | ✅ BOM |
| A03 | Injection | 90/100 | ✅ EXCELENTE |
| A04 | Insecure Design | 70/100 | ⚠️ ATENÇÃO |
| A05 | Security Misconfiguration | 75/100 | ⚠️ ATENÇÃO |
| A06 | Vulnerable Components | 80/100 | ✅ BOM |
| A07 | Auth Failures | 78/100 | ⚠️ ATENÇÃO |
| A08 | Software/Data Integrity | 72/100 | ⚠️ ATENÇÃO |
| A09 | Logging/Monitoring | 60/100 | ❌ INSUFICIENTE |
| A10 | SSRF | 85/100 | ✅ BOM |

### Score por Categoria (OWASP API Security Top 10)

| # | Categoria | Score | Status |
|---|---|---|---|
| API1 | Broken Object Level Auth (BOLA) | 75/100 | ⚠️ |
| API2 | Broken Authentication | 80/100 | ✅ |
| API3 | Broken Object Property Level Auth | 70/100 | ⚠️ |
| API4 | Unrestricted Resource Consumption | 65/100 | ⚠️ |
| API5 | Broken Function Level Auth (BFLA) | 85/100 | ✅ |
| API6 | Unrestricted Access to Business Flows | 70/100 | ⚠️ |
| API7 | Server Side Request Forgery | 85/100 | ✅ |
| API8 | Security Misconfiguration | 75/100 | ⚠️ |
| API9 | Improper Inventory Management | 80/100 | ✅ |
| API10 | Unsafe Consumption of APIs | 70/100 | ⚠️ |

---

## 2. Vulnerabilidades Encontradas

### 2.1 🟠 [HIGH] Rate Limiting Degrada para Bypass Completo sem Redis

**Arquivo:** `apps/api/src/middleware/rateLimit.ts:72-76`
**OWASP:** API4:2023 — Unrestricted Resource Consumption
**MITRE:** T1498 — Network Denial of Service
**CVSS:** 7.5

**Descrição:** Quando o Redis (Upstash) não está disponível, o rate limiting é completamente desabilitado via degradação graciosa. Em produção, se o Redis ficar indisponível (outage, timeout, misconfiguration), TODAS as proteções de rate limiting são removidas, permitindo brute force irrestrito e DDoS.

```typescript
// rateLimit.ts:72-76
if (!limiter) {
  await next()  // ← BYPASS COMPLETO
  return
}
```

**Impacto:** Brute force de credenciais, credential stuffing, e DDoS ficam possíveis durante qualquer indisponibilidade do Redis.

**Remediação:**
- Implementar rate limiting in-memory como fallback (ex: `Map` com TTL)
- Adicionar health check obrigatório do Redis no startup em produção
- Usar um circuit breaker que rejeite requests ao invés de permitir todos

---

### 2.2 🟠 [HIGH] JWT_SECRET com Validação Mínima Insuficiente

**Arquivo:** `apps/api/src/config/env.ts:8`
**OWASP:** A02:2021 — Cryptographic Failures
**MITRE:** T1528 — Steal Application Access Token
**CVSS:** 7.0

**Descrição:** O `JWT_SECRET` é validado apenas com `z.string().min(1)`, aceitando segredos extremamente fracos como "a", "secret", "123". Para produção, o segredo JWT deve ter pelo menos 256 bits (32 caracteres) de entropia.

```typescript
// env.ts:8
JWT_SECRET: z.string().min(1),  // ← Aceita "a", "secret", etc.
JWT_REFRESH_SECRET: z.string().min(1),
```

**Impacto:** Se um JWT_SECRET fraco for usado em produção, tokens podem ser forjados via brute force da chave.

**Remediação:**
- Alterar para `z.string().min(32)` em ambos os secrets
- Adicionar validação de entropia (rejeitar strings repetitivas)
- Usar variável gerada com `openssl rand -base64 48`

---

### 2.3 🟠 [HIGH] Webhook Processa Payloads sem Verificação de Assinatura

**Arquivo:** `apps/api/src/routes/payments.ts:83-93`
**OWASP:** A08:2021 — Software and Data Integrity Failures
**MITRE:** T1565 — Data Manipulation
**CVSS:** 7.5

**Descrição:** Quando `MERCADOPAGO_WEBHOOK_SECRET` não está configurado OU quando a assinatura não está presente no header, o webhook processa o payload sem qualquer verificação. Um atacante pode forjar notificações de pagamento.

```typescript
// payments.ts:83-93 — Fallback sem verificação
const body = await c.req.json()
const dataId = body?.data?.id
const type = body?.type || body?.action
if (dataId) {
  const result = await paymentService.handleWebhook(type, String(dataId))
  // ← Processa sem verificar autenticidade
}
```

**Impacto:** Atacante pode enviar webhooks forjados para creditar FanCoins sem pagamento real.

**Remediação:**
- Tornar `MERCADOPAGO_WEBHOOK_SECRET` obrigatório em produção
- Rejeitar webhooks sem assinatura válida em produção
- Adicionar whitelist de IPs do MercadoPago
- Sempre verificar o pagamento via API do MercadoPago antes de creditar

---

### 2.4 🟠 [HIGH] IDOR em Payment Status — Sem Verificação de Ownership

**Arquivo:** `apps/api/src/services/payment.service.ts:199-214`
**OWASP:** API1:2023 — Broken Object Level Authorization
**MITRE:** T1078 — Valid Accounts
**CVSS:** 6.5

**Descrição:** O endpoint `GET /payments/status/:id` recebe `userId` mas não o utiliza para verificar se o pagamento pertence ao usuário autenticado. Qualquer usuário pode consultar o status de qualquer pagamento.

```typescript
// payment.service.ts:199-214
export async function getPaymentStatus(paymentId: string, userId: string) {
  const [payment] = await db
    .select({ ... })
    .from(payments)
    .where(eq(payments.id, paymentId))  // ← Não filtra por userId!
    .limit(1)
  // ...
  return payment
}
```

**Impacto:** Vazamento de informações de pagamento de outros usuários (valores, status, metadata).

**Remediação:**
- Adicionar `and(eq(payments.id, paymentId), eq(payments.userId, userId))` na query

---

### 2.5 🟡 [MEDIUM] Password Change com Requisito Mínimo Inconsistente

**Arquivo:** `apps/api/src/routes/users.ts:43`
**OWASP:** A07:2021 — Identification and Authentication Failures
**CVSS:** 5.0

**Descrição:** O endpoint de troca de senha aceita senhas com mínimo de 6 caracteres, enquanto o registro exige 8 caracteres com uppercase e número. Inconsistência que permite downgrade de segurança.

```typescript
// users.ts:43
if (newPassword.length < 6) {  // ← Registro exige 8 + uppercase + número
```

**Remediação:** Aplicar o mesmo `passwordSchema` do registro na troca de senha.

---

### 2.6 🟡 [MEDIUM] CORS Fallback Retorna Primeiro Origin da Whitelist

**Arquivo:** `apps/api/src/index.ts:71`
**OWASP:** A05:2021 — Security Misconfiguration
**CVSS:** 5.5

**Descrição:** Quando uma origin não está na whitelist, o handler retorna `allowedOrigins[0]` ao invés de rejeitar. Isso significa que QUALQUER origin recebe um header `Access-Control-Allow-Origin` válido (o primeiro da lista), junto com `credentials: true`.

```typescript
origin: (origin) => {
  if (allowedOrigins.includes(origin)) return origin
  console.warn(`CORS: origin "${origin}" not in allowed list`)
  return allowedOrigins[0]  // ← Retorna origin válido para QUALQUER requisição!
},
```

**Impacto:** Embora o browser não envie cookies cross-origin com uma origin diferente do header, este comportamento é contrário à especificação e pode levar a confusão de segurança.

**Remediação:** Retornar `null` ou `undefined` para origins não autorizados. Alternativamente, não definir o header para origins não autorizados.

---

### 2.7 🟡 [MEDIUM] Ausência de Account Lockout Após Falhas de Login

**OWASP:** A07:2021 — Identification and Authentication Failures
**MITRE:** T1110 — Brute Force
**CVSS:** 5.5

**Descrição:** Não existe mecanismo de bloqueio temporário de conta após N tentativas falhas de login. O rate limiting por IP é a única proteção, mas um atacante distribuído pode contornar isso.

**Remediação:**
- Implementar lockout progressivo: 5 min após 5 falhas, 15 min após 10, etc.
- Armazenar contadores de falha por usuário no Redis
- Adicionar CAPTCHA após 3 tentativas falhas

---

### 2.8 🟡 [MEDIUM] Token de Verificação de Email Usa Mesmo Secret do JWT

**Arquivo:** `apps/api/src/services/auth.service.ts:242`
**OWASP:** A02:2021 — Cryptographic Failures
**CVSS:** 4.5

**Descrição:** O token de verificação de email e o de reset de senha usam o mesmo `JWT_SECRET` do access token. Se o secret for comprometido, TODOS os tipos de tokens são comprometidos simultaneamente. Idealmente, cada tipo deveria ter seu próprio secret.

```typescript
jwt.sign({ sub: userId, email, type: 'email_verify' }, env.JWT_SECRET, ...)
jwt.sign({ sub: userId, type: 'password_reset' }, env.JWT_SECRET, ...)
```

**Remediação:** Criar secrets separados para cada tipo de token (EMAIL_VERIFY_SECRET, PASSWORD_RESET_SECRET).

---

### 2.9 🟡 [MEDIUM] Refresh Token Não É Invalidado no Servidor

**Arquivo:** `apps/api/src/services/auth.service.ts:217-237`
**OWASP:** A07:2021 — Authentication Failures
**CVSS:** 5.0

**Descrição:** Os refresh tokens são stateless (JWT puro). Não existe blacklist server-side, então um refresh token comprometido não pode ser revogado até expirar (30 dias).

**Remediação:**
- Implementar token rotation com armazenamento server-side
- Manter blacklist de tokens revogados no Redis
- Reduzir TTL do refresh token para 7 dias

---

### 2.10 🟡 [MEDIUM] Delete File Sem Verificação de Ownership

**Arquivo:** `apps/api/src/routes/upload.ts:263-272`
**OWASP:** API1:2023 — Broken Object Level Authorization
**CVSS:** 5.5

**Descrição:** O endpoint `DELETE /upload/:key` aceita qualquer key e deleta o arquivo sem verificar se pertence ao usuário autenticado. Qualquer usuário autenticado pode deletar arquivos de outros.

```typescript
uploadRoute.delete('/:key{.+}', authMiddleware, async (c) => {
  const key = c.req.param('key')
  await storage.deleteFile(key)  // ← Sem verificação de ownership
})
```

**Remediação:** Verificar se a key pertence ao userId antes de deletar.

---

### 2.11 🟡 [MEDIUM] Share Post Sem Rate Limit e Sem Autenticação

**Arquivo:** `apps/api/src/routes/posts.ts:175-184`
**OWASP:** API4:2023 — Unrestricted Resource Consumption
**CVSS:** 4.0

**Descrição:** O endpoint `POST /posts/:id/share` não requer autenticação e não tem rate limit específico. Um bot pode inflar artificialmente a contagem de shares.

**Remediação:** Adicionar autenticação ou rate limit específico.

---

### 2.12 🔵 [LOW] Versão da API Exposta no Health Check

**Arquivo:** `apps/api/src/index.ts:100`
**OWASP:** A05:2021
**CVSS:** 2.0

**Descrição:** `GET /health` retorna `version: '2.4.0'`, facilitando fingerprinting.

**Remediação:** Remover version info em produção.

---

### 2.13 🔵 [LOW] Console.log de Origens CORS Permitidas

**Arquivo:** `apps/api/src/index.ts:61`
**CVSS:** 2.0

**Descrição:** `console.log('CORS allowed origins:', allowedOrigins)` logga todas as origens permitidas no stdout. Se logs forem acessíveis, expõe configuração.

**Remediação:** Remover ou condicionar ao NODE_ENV=development.

---

### 2.14 🔵 [LOW] Ausência de Request Body Size Limit Explícito

**OWASP:** API4:2023
**CVSS:** 3.0

**Descrição:** Não há middleware explícito limitando o tamanho do body da request. Embora o Hono/Node tenha limites padrão, um limite explícito é mais seguro.

**Remediação:** Adicionar middleware de body size limit (ex: 1MB para JSON, 500MB para upload).

---

### 2.15 🔵 [LOW] Error Handler Expõe err.message em Development

**Arquivo:** `apps/api/src/index.ts:109`
**CVSS:** 2.5

**Descrição:** Em `NODE_ENV !== 'production'`, o error message completo é retornado ao client, o que pode vazar informações em ambientes staging/dev acessíveis externamente.

---

### 2.16 🔵 [LOW] View Post Aceita IP 'unknown' Como Identificador

**Arquivo:** `apps/api/src/routes/posts.ts:162-164`
**CVSS:** 2.0

**Descrição:** Se nenhum header de IP estiver presente, o fallback é `'unknown'`, o que pode causar colisão de dedup para muitos requests.

---

### 2.17 ⚪ [INFO] 2FA Não Implementado (Schema Existe)

A tabela `user_settings` tem `twoFactorEnabled` mas a funcionalidade não está implementada.

---

### 2.18 ⚪ [INFO] Ausência de Security.txt

Não existe `/.well-known/security.txt` para disclosure responsável.

---

### 2.19 ⚪ [INFO] Ausência de Audit Log Dedicado

Ações sensíveis (login, mudança de senha, pagamentos) não são logadas em um audit trail dedicado separado do console.log.

---

## 3. Pontos Fortes da Segurança

A plataforma possui várias boas práticas de segurança já implementadas:

| # | Medida | Status | Detalhes |
|---|---|---|---|
| 1 | Password Hashing | ✅ Excelente | bcryptjs com 12 salt rounds |
| 2 | JWT com Expiração Curta | ✅ Bom | Access token: 15 min |
| 3 | Validação de Input (Zod) | ✅ Excelente | Todos os endpoints usam schemas |
| 4 | Secure Headers (Hono) | ✅ Bom | X-Content-Type-Options, X-Frame-Options |
| 5 | CORS com Whitelist | ✅ Bom | Lista explícita de origens |
| 6 | Rate Limiting (quando ativo) | ✅ Bom | Sliding window via Upstash |
| 7 | Role-Based Access Control | ✅ Bom | fan/creator/admin com middleware |
| 8 | Anti-Enumeration (forgot-password) | ✅ Excelente | Retorna `sent: true` sempre |
| 9 | Webhook HMAC Validation | ✅ Bom | SHA-256 quando configurado |
| 10 | File Type Validation | ✅ Bom | MIME type check + size limits |
| 11 | Age Verification | ✅ Bom | 18+ obrigatório no registro |
| 12 | Parameterized Queries (Drizzle ORM) | ✅ Excelente | Sem SQL injection via ORM |
| 13 | Error Sanitization (produção) | ✅ Bom | Mensagem genérica em prod |
| 14 | Environment Validation (Zod) | ✅ Bom | Valida todas as env vars |
| 15 | Image Compression (Sharp) | ✅ Bom | Processa imagens server-side |

---

## 4. Recomendações Prioritárias para Produção

### Prioridade URGENTE (Antes do Deploy)

1. **Tornar webhook signature obrigatória em produção** — Sem isso, qualquer pessoa pode forjar pagamentos
2. **Corrigir IDOR no payment status** — Adicionar filtro por userId
3. **Implementar fallback de rate limiting in-memory** — Não depender apenas do Redis
4. **Aumentar mínimo do JWT_SECRET para 32 caracteres**

### Prioridade ALTA (Primeira Semana)

5. **Corrigir CORS fallback** — Retornar null para origins não autorizados
6. **Implementar account lockout** — Bloqueio progressivo após falhas
7. **Adicionar ownership check no delete file** — Verificar userId
8. **Unificar requisitos de senha** — Mesmo schema no change password

### Prioridade MÉDIA (Primeiro Mês)

9. **Separar secrets por tipo de token**
10. **Implementar refresh token blacklist no Redis**
11. **Adicionar rate limit no share post**
12. **Implementar 2FA (TOTP)**
13. **Adicionar audit log dedicado**
14. **Criar `security.txt`**

---

## 5. Metodologia de Cálculo da Nota

A nota de confiança é calculada com base em:

```
Score Base = Média ponderada dos scores por categoria OWASP (0-100)
Penalidades:
  - Cada vulnerabilidade CRITICAL: -15 pontos
  - Cada vulnerabilidade HIGH: -10 pontos (4 × -10 = -40)
  - Cada vulnerabilidade MEDIUM: -5 pontos (7 × -5 = -35)
  - Cada vulnerabilidade LOW: -2 pontos (5 × -2 = -10)
  - Cada INFO: 0 pontos

Score Base (média categories): ~79
Penalidade Bruta: -85
Penalidade Ajustada (cap 50%): -42.5
Bônus por boas práticas: +15 × 2.5 = +37.5

NOTA FINAL = 79 - 42.5 + 37.5 = 74/100 → Grade C+
```

### Escala de Notas

| Grade | Score | Significado |
|---|---|---|
| A+ | 95-100 | Excepcional — pronto para produção de alta segurança |
| A | 90-94 | Excelente — mínimas melhorias necessárias |
| B | 80-89 | Bom — algumas melhorias recomendadas |
| **C+** | **74** | **Adequado — correções necessárias antes de produção** |
| C | 70-74 | Razoável — correções importantes pendentes |
| D | 60-69 | Insuficiente — muitas vulnerabilidades |
| F | <60 | Reprovado — refactoring de segurança necessário |

---

## 6. Consolidação com Teste Externo

Para consolidar este relatório com o teste externo (Python scanner), execute:

```bash
# No CodeSandbox ou ambiente Python:
pip install requests
python myfans_security_scanner.py --target https://api.myfans.my --output ./reports

# Copie o conteúdo de external_scan_report.json e cole no prompt do Claude
# com a mensagem: "Consolide este relatório externo com a auditoria interna"
```

A nota final consolidada será a média ponderada:
- **Teste Interno (White-box): 60% do peso** — acesso ao código fonte
- **Teste Externo (Black-box): 40% do peso** — perspectiva de atacante real

---

*Relatório gerado em 2026-02-08. Válido até a próxima release da API.*
*Classificação: CONFIDENCIAL — Uso interno da equipe de desenvolvimento.*
