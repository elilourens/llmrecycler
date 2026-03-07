# API Recycler Proxy Implementation Guide

## Overview
This document describes the complete proxy implementation for API Recycler, which routes buyer requests through seller API keys with automatic pricing, wallet management, and error handling.

## Architecture

### Core Flow
```
Buyer Request → Auth Middleware → Provider Detection →
LRU Key Selection → Vault Secret Retrieval →
Forward to Provider → Extract Tokens → Calculate Costs →
Log Request → Update Wallets (via Trigger)
```

## Database Changes

### New Column
- **seller_keys.suspended_until** (TIMESTAMPTZ) — Used for key suspension with recovery time or indefinite (NULL)

### New Trigger
- **trigger_update_wallets** — Fires after INSERT on requests_log
  - Deducts cost_charged from buyer wallet
  - Credits seller_earning to seller wallet
  - Uses SECURITY DEFINER for safe RLS environment

## Backend Implementation

### 1. **Utility Files**

#### `utils/provider-detection.ts`
Detects providers from model names using prefix matching.

**Functions:**
- `detectProvider(model: string): string | null` — Returns provider or null
- `isValidProvider(provider: string): boolean` — Validates provider name

**Supported Providers:**
- Anthropic: `claude-*`
- OpenAI: `gpt-*`
- Google: `gemini-*`
- DeepSeek: `deepseek-*`

#### `utils/pricing.ts`
Calculates request costs from token counts and pricing data.

**Functions:**
- `getPricing(provider: string, model: string)` — Queries provider_pricing table
- `calculateCosts(...)` — Computes cost_upstream, cost_charged, seller_earning, your_margin

**Cost Calculation:**
```
cost_upstream = (input_tokens * input_rate + output_tokens * output_rate) / 1_000_000
cost_charged = cost_upstream * (1 + marginPercent / 100)  // 10% default
seller_earning = cost_upstream
your_margin = cost_charged - cost_upstream
```

#### `utils/vault-cache.ts`
In-memory 60-second cache for vault secrets.

**Functions:**
- `getVaultSecret(sellerKeyId: string)` — Returns decrypted secret via RPC
- `clearVaultCache(sellerKeyId?: string)` — Clears cache entry or entire cache

**Security Note:** Secrets are decrypted inside Postgres via `get_seller_key_secret` RPC; plaintext never leaves database.

### 2. **Middleware**

#### `middleware/proxy-auth.ts`
Validates buyer API key via RPC and checks wallet balance.

**Flow:**
1. Extract x-api-key header
2. Call `verify_buyer_key_by_secret` RPC (comparison happens in Postgres)
3. Check key status is 'active'
4. Fetch wallet and verify balance > 0
5. Attach ProxyContext for downstream handlers

**Error Responses:**
- 401: Missing/invalid API key
- 401: Key not active
- 402: Insufficient balance
- 500: Wallet not found

### 3. **Routes**

#### `routes/proxy.ts`
Main proxy endpoint handling POST requests.

**Request Flow:**
1. **Validate Model** — Check model parameter exists and is string
2. **Detect Provider** — Map model to provider (400 if unknown)
3. **Select LRU Key** — Query seller_keys with FOR UPDATE SKIP LOCKED
4. **Fetch Secret** — Call get_seller_key_secret RPC (cached for 60s)
5. **Get Pricing** — Query provider_pricing table
6. **Forward Request** — POST to provider with provider-specific auth headers
7. **Extract Tokens** — Parse response for input/output token counts
8. **Calculate Costs** — Apply pricing and margin
9. **Update last_checked_at** — Mark key as recently used
10. **Log Request** — Insert to requests_log (triggers wallet updates)
11. **Return Response** — Stream response back to buyer

**Provider-Specific Headers:**
- Anthropic: `x-api-key: {secret}`
- OpenAI: `Authorization: Bearer {secret}`
- Google: `x-goog-api-key: {secret}`
- DeepSeek: `Authorization: Bearer {secret}`

**Provider-Specific Token Extraction:**
- Anthropic: `response.usage.input_tokens` / `output_tokens`
- OpenAI: `response.usage.prompt_tokens` / `completion_tokens`
- Google: `response.usageMetadata.promptTokenCount` / `candidatesTokenCount`
- DeepSeek: `response.usage.prompt_tokens` / `completion_tokens`

**Error Handling:**

| Status | Action | Retry? |
|--------|--------|--------|
| 429 | Suspend key 60s (except DeepSeek: no suspension) | Yes |
| 402 | Suspend indefinitely (manually reviewed) | No |
| 401/403 | Deactivate permanently | No |
| Other | Log error | No |

### 4. **RPC Functions**

#### `verify_buyer_key_by_secret(p_api_key TEXT)`
Securely verifies buyer API key by comparing in Postgres (secret never exposed).

```sql
SELECT bk.id, bk.user_id, bk.status
FROM buyer_keys bk
JOIN vault.decrypted_secrets vs ON bk.vault_secret_ref::uuid = vs.id
WHERE vs.decrypted_secret = p_api_key
  AND bk.status = 'active'
LIMIT 1;
```

#### `select_lru_seller_key(p_provider TEXT, p_exclude_ids UUID[])`
Atomically selects least-recently-used seller key with transaction locking.

```sql
WHERE provider = p_provider
  AND status = 'active'
  AND verified_at IS NOT NULL
  AND (suspended_until IS NULL OR suspended_until < NOW())
  AND NOT (id = ANY(p_exclude_ids))
ORDER BY last_checked_at ASC NULLS FIRST
FOR UPDATE SKIP LOCKED
LIMIT 1
```

**Why FOR UPDATE SKIP LOCKED:**
- Locks selected row so other transactions can't grab it
- SKIP LOCKED skips already-locked rows (parallel requests each get different keys)
- Prevents thundering herd on single key

#### `get_seller_key_secret(p_seller_key_id UUID)`
Retrieves decrypted secret from Supabase Vault.

```sql
SELECT vs.decrypted_secret
FROM vault.decrypted_secrets vs
JOIN seller_keys sk ON sk.vault_secret_ref::uuid = vs.id
WHERE sk.id = p_seller_key_id
  AND sk.status = 'active'
```

**Security:** Only accessible with service_role key. Decryption happens inside Postgres.

### 5. **Request Logging**

Every request (success or error) logged to `requests_log`:
- **buyer_key_id, seller_key_id** — Which keys were used
- **provider, model** — What was requested
- **input_tokens, output_tokens** — From provider response (null on error)
- **input_rate_used, output_rate_used** — Pricing snapshot (for historical accuracy)
- **cost_upstream, cost_charged, seller_earning, your_margin** — Financial breakdown
- **status_code, error_message** — HTTP status and error details
- **latency_ms** — Request duration

**Trigger Fires On:** INSERT on requests_log where cost_charged IS NOT NULL

### 6. **Wallet Updates**

Automatically handled by `update_wallets_after_request()` trigger:

```sql
-- Deduct from buyer
UPDATE wallets
SET balance = balance - cost_charged,
    total_spent = total_spent + cost_charged,
    updated_at = NOW()
WHERE user_id = v_buyer_user_id;

-- Credit seller
UPDATE wallets
SET balance = balance + seller_earning,
    total_earned = total_earned + seller_earning,
    updated_at = NOW()
WHERE user_id = v_seller_user_id;
```

## API Usage

### Proxy Endpoint

**Endpoint:** `POST /api/proxy/*`

**Headers:**
- `x-api-key: <buyer-api-key>` (required)
- `Content-Type: application/json`

**Request Body:**
Forward to provider as-is, must include `model` field.

```json
{
  "model": "claude-3-sonnet-20240229",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "max_tokens": 1024
}
```

**Response:** Streamed directly from provider (transparent pass-through)

**Error Responses (Anthropic-compatible format):**
```json
{
  "error": {
    "type": "error_type",
    "message": "Human readable message"
  }
}
```

## Configuration

### Environment Variables
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (for vault access)
- `FRONTEND_URL` — CORS origin

### Margin Configuration
Edit `utils/pricing.ts` `calculateCosts()` default parameter:
```typescript
marginPercent: number = 10  // Change to your desired percentage
```

### Cache TTL
Edit `utils/vault-cache.ts`:
```typescript
const CACHE_TTL_MS = 60 * 1000;  // 60 seconds
```

## Monitoring & Debugging

### Request Logs
Query `requests_log` table:
```sql
SELECT * FROM requests_log
ORDER BY created_at DESC
LIMIT 100;
```

### Wallet Status
```sql
SELECT user_id, balance, total_spent, total_earned
FROM wallets
ORDER BY updated_at DESC;
```

### Suspended Keys
```sql
SELECT id, provider, suspended_until, last_checked_at
FROM seller_keys
WHERE suspended_until > NOW();
```

### Failed Requests
```sql
SELECT * FROM requests_log
WHERE status_code >= 400
ORDER BY created_at DESC;
```

## Security Notes

1. **Vault Secrets:** Stored in Supabase Vault, decrypted only inside Postgres
2. **Service Role:** Proxy backend uses service_role key (needed for vault access)
3. **No Secret Logging:** Secrets never logged; only vault_secret_ref or key_hint logged
4. **Balance Check:** Verified before forwarding request (prevents negative balances)
5. **Atomic Key Selection:** FOR UPDATE SKIP LOCKED prevents race conditions
6. **Token Verification:** RPC comparison in Postgres (never expose plaintext for matching)

## Implementation Checklist

- [x] Add `suspended_until` column to seller_keys
- [x] Create wallet update trigger
- [x] Implement provider detection
- [x] Implement pricing calculation
- [x] Create vault secret RPC functions
- [x] Implement buyer auth middleware
- [x] Create LRU key selection RPC with FOR UPDATE SKIP LOCKED
- [x] Build proxy route with error handling
- [x] Implement request logging
- [x] Update CORS headers for x-api-key
- [ ] Test with real provider API
- [ ] Monitor wallet updates in production
- [ ] Set up pricing data in provider_pricing table

## Testing

### Test Buyer Key Creation
```bash
curl -X POST http://localhost:3001/api/buyer-keys \
  -H "Authorization: Bearer <user-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-key"}'
```

### Test Proxy Request
```bash
curl -X POST http://localhost:3001/api/proxy/v1/messages \
  -H "x-api-key: <buyer-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-sonnet-20240229",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }'
```

### Check Request Log
```sql
SELECT buyer_key_id, provider, model, input_tokens, output_tokens,
       cost_charged, status_code, latency_ms, created_at
FROM requests_log
ORDER BY created_at DESC
LIMIT 5;
```

## Troubleshooting

**Issue:** 401 Invalid API key
- Check buyer key is active: `SELECT status FROM buyer_keys WHERE id = '...'`
- Verify x-api-key header is correct

**Issue:** 402 Insufficient balance
- Check wallet balance: `SELECT balance FROM wallets WHERE user_id = '...'`
- Top up wallet to continue

**Issue:** 503 No available keys
- Check seller keys: `SELECT COUNT(*) FROM seller_keys WHERE provider = 'Anthropic' AND status = 'active'`
- Ensure keys are verified: `SELECT verified_at FROM seller_keys`
- Check for suspended keys: `SELECT suspended_until FROM seller_keys WHERE suspended_until > NOW()`

**Issue:** Secrets not decrypting
- Verify using service_role key (not anon key)
- Check vault_secret_ref is valid UUID format
- Ensure seller_keys.is_active = true

## Future Enhancements

1. **Streaming Support:** Buffer final usage chunk to extract tokens without blocking stream
2. **Retry Logic:** Implement exponential backoff for 429 responses
3. **Key Rotation:** Automatic rotation of suspended keys after timeout
4. **Analytics:** Dashboard for cost tracking and provider performance
5. **Webhook Notifications:** Alert on key suspension or wallet depletion
