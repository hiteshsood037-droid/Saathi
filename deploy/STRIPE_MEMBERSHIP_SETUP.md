# Jodi (Saathi) — Stripe Premium Membership Setup

> **Status:** Preparation only. This document specifies the exact Stripe-side
> configuration to activate the **Premium** tier the moment Stripe is onboarded.
> **Do not create the live product yet** — that step is owner-gated and requires
> a connected Stripe account. Use this to configure Test mode now and replicate
> in Live mode at launch.

---

## 1. Objective

The `create-checkout-session` edge function already opens a `mode: 'subscription'`
Checkout for the Premium tier, and `stripe-webhook` writes the result into
`profiles.subscription_tier` via the `handle_stripe_subscription_update` RPC.
This document defines:

1. The exact Premium **product + recurring price** to create in Stripe.
2. The **price ID → environment variable** mapping the edge functions expect.
3. The **metadata contract** (keys the checkout/webhook read and write).
4. The **9 Premium feature flags** (single source of truth for feature-gating).

---

## 2. The 9 Premium Features (canonical)

The Premium tier unlocks **exactly these 9 features**. This list mirrors
`/home/team/shared/webapp/src/lib/features.js` (the feature-gating source of
truth used by the webapp). Gold is a superset that includes all of these.

| # | Feature key          | Label                 | Icon | Description |
|---|----------------------|-----------------------|------|-------------|
| 1 | `unlimited_likes`    | Unlimited Likes       | ❤️  | Swipe as much as you want — no 20-per-day cap. |
| 2 | `unlimited_picks`    | Unlimited Daily Picks | ⭐  | Unlock every curated match, not just a daily preview. |
| 3 | `ai_dating_coach`    | AI Dating Coach       | 💡  | Personalized dating advice, openers, and conversation tips. |
| 4 | `ai_bio_optimizer`   | AI Bio Optimizer      | ✨  | AI rewrites and grades your bio to get more matches. |
| 5 | `read_receipts`      | Read Receipts         | ✓✓  | See when your messages have been read. |
| 6 | `passport_mode`      | Passport Mode         | 🌍  | Browse and chat across any city, not just your own. |
| 7 | `see_who_liked`      | See Who Liked You     | 👀  | Instantly see everyone who already liked your profile. |
| 8 | `advanced_filters`   | Advanced Filters      | 🎯  | Filter by height, religion, language, diet, and more. |
| 9 | `priority_boost`     | Priority Profile Boost| 🚀  | Get boosted to the top of other people's discover feeds. |

Feature-gating on the frontend is **tier-driven**: the app reads
`profiles.subscription_tier` (`Free` | `Premium` | `Gold`) and maps it to these
flags in `features.js`. The Stripe metadata feature list below is a *portable,
optional* mirror — the app does **not** need to read features from Stripe to
gate correctly.

---

## 3. Stripe Dashboard Steps (Test mode first)

### 3.1 Create the Premium Product

1. Log in to [dashboard.stripe.com](https://dashboard.stripe.com/).
2. Confirm you are in **Test mode** (toggle in the top-right) while preparing.
3. Go to **Product catalog** (left sidebar) → **+ Add product**.
4. Fill in:
   - **Name:** `Jodi Premium Membership`
   - **Description:** `Monthly Premium subscription for the Jodi (Saathi) dating app.`
   - (Optional) upload a product image.
5. Under **Pricing model**, choose **Recurring** → **Standard pricing**.
6. Click **Add a price** and set:
   - **Price:** `14.99` USD
   - **Billing period:** **Monthly** (every 1 month, recurring)
   - **Currency:** `USD`
   - (Recommended) **Price ID / nickname:** `premium_monthly` (human-friendly only).
7. **Save product**.

### 3.2 Capture the Price ID

After saving, the price is assigned a Stripe ID like `price_1Nxxxxx...`.

- Open the product → click the price.
- Copy the **price ID** (`price_...`).

This value is the **`STRIPE_PRICE_PREMIUM_ID`** environment variable.

> **Live mode:** when the owner connects a live Stripe account, repeat the same
> steps in **Live mode** and set `STRIPE_PRICE_PREMIUM_ID` to the *live* `price_...`.

### 3.3 (Optional) Store the feature list on the Product

On the product page, add **Metadata** (key/value) so the definition travels with
the product for documentation and any future server-side feature-gating:

| Metadata key | Value |
|--------------|-------|
| `tier` | `Premium` |
| `price_usd` | `14.99` |
| `features` | `unlimited_likes,unlimited_picks,ai_dating_coach,ai_bio_optimizer,read_receipts,passport_mode,see_who_liked,advanced_filters,priority_boost` |

*(Stripe metadata limits: ≤ 50 keys, key ≤ 40 chars, value ≤ 500 chars. The
comma-separated `features` value above is ~180 chars — well within limits.)*

---

## 4. Environment Variables (Edge Function Secrets)

Both edge functions read these at runtime. Set them via
`supabase secrets set` or the Supabase Dashboard **Edge Functions → Settings →
Environment Variables**.

| Variable | Required | Used by | Value / Notes |
|----------|----------|---------|---------------|
| `STRIPE_SECRET_KEY` | ✅ | both | Stripe secret key (`sk_test_...` in test, `sk_live_...` live). |
| `STRIPE_PRICE_PREMIUM_ID` | ✅ | create-checkout-session | The Premium `price_...` from §3.2. |
| `STRIPE_PRICE_GOLD_ID` | 🔶 | create-checkout-session | Gold price `price_...` (separate task). |
| `STRIPE_WEBHOOK_SIGN_SECRET` | ✅ | stripe-webhook | `whsec_...` from §5. **Critical** — see §6.1. |
| `SUPABASE_URL` | ✅ | both | `https://<project-ref>.supabase.co`. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | stripe-webhook | Service-role key (webhook writes via RPC). |
| `SUPABASE_ANON_KEY` | ✅ | create-checkout-session | Anon key (passes through user JWT). |
| `APP_REDIRECT_URL` | 🔶 | create-checkout-session | Web app base URL for success/cancel redirects. Defaults to `jodiapp://` (mobile deep link) — set to the web app origin for web checkout. |

> **⚠️ Known gap:** `deploy/deploy.sh` currently only wires
> `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SIGN_SECRET`, and `OPENAI_API_KEY`.
> `STRIPE_PRICE_PREMIUM_ID` (and `STRIPE_PRICE_GOLD_ID`, `APP_REDIRECT_URL`)
> must be added to the secrets list before go-live.

---

## 5. Stripe Webhook Endpoint

1. Go to **Developers → Webhooks** → **+ Add endpoint**.
2. **Endpoint URL:**
   `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
   (for this project: `https://gkzmhonyrbvwjgwolqum.supabase.co/functions/v1/stripe-webhook`)
3. **Events to send** (minimum — these are what the handler processes):
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Click **Add endpoint**, then reveal and copy the **Signing secret**
   (`whsec_...`) → set as `STRIPE_WEBHOOK_SIGN_SECRET`.

---

## 6. Edge Function Verification Findings

I reviewed both edge functions for a real **recurring** Premium subscription.
Summary of what is correct and what needs attention.

### 6.1 `create-checkout-session` — ✅ correct, ⚠️ env wiring required

| Check | Result |
|-------|--------|
| `mode: 'subscription'` (recurring, not one-time) | ✅ Correct |
| Tier validation (`Premium` / `Gold`) | ✅ Correct |
| `metadata.userId` + `metadata.subscriptionTier` on the session | ✅ Correct |
| `subscription_data.metadata` (copied onto the Subscription object) | ✅ Correct — lets `customer.subscription.updated/deleted` read `userId`/`tier` |
| Fallback price `price_mock_premium_1499` | ⚠️ Will error against the real Stripe API. **Must set `STRIPE_PRICE_PREMIUM_ID`.** |
| `APP_REDIRECT_URL` defaults to `jodiapp://` | ⚠️ Fine for the Expo app; set to the web app origin for web checkout. |

### 6.2 `stripe-webhook` — ✅ correct, hardened, ⚠️ security flag

| Check | Result |
|-------|--------|
| Handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` | ✅ Correct |
| Calls `handle_stripe_subscription_update(p_user_id, p_tier, p_ends_at)` | ✅ Correct (matches DB RPC signature) |
| Reads `userId`/`subscriptionTier` from metadata | ✅ Correct |
| **NEW:** respects `subscription.status` → downgrades to `Free` on `past_due`/`unpaid`/`canceled`/`incomplete` | ✅ Hardened (this PR) — prevents lapsed cards keeping Premium |
| Signature verification fallback: when `STRIPE_WEBHOOK_SIGN_SECRET` is empty it does `JSON.parse(body)` **without verifying** | ⚠️ **Security-critical:** this is a dev-only fallback. **Never leave `STRIPE_WEBHOOK_SIGN_SECRET` unset in production** — otherwise anyone can POST a forged event to grant themselves Premium. |

### 6.3 Recommended follow-ups (not blockers for MVP)

- **Payment-failure dunning:** consider also subscribing to `invoice.payment_failed`
  to notify users; the `customer.subscription.updated` handler already downgrades
  on `past_due`, which is the important part.
- **Customer linkage:** `create-checkout-session` could pass `customer_email`
  (from `auth.users`) to make the customer record easier to reconcile in the
  Stripe dashboard. Optional.

---

## 7. Metadata Contract (summary)

**Checkout Session** (set by `create-checkout-session`):

```json
{
  "metadata": { "userId": "<auth.users.id>", "subscriptionTier": "Premium" },
  "subscription_data": {
    "metadata": { "userId": "<auth.users.id>", "subscriptionTier": "Premium" }
  }
}
```

**Webhook events** (read by `stripe-webhook`):

| Event | Reads | Action |
|-------|-------|--------|
| `checkout.session.completed` | `session.metadata.userId`, `session.metadata.subscriptionTier`, `session.subscription` | grant tier + `subscription_ends_at` |
| `customer.subscription.updated` | `subscription.metadata.userId`, `subscription.metadata.subscriptionTier`, `subscription.status`, `subscription.current_period_end` | grant/downgrade tier by status |
| `customer.subscription.deleted` | `subscription.metadata.userId` | set tier = `Free`, ends_at = `null` |

---

## 8. Go-Live Checklist

- [ ] Create Premium product + `$14.99/month` recurring price in **Test mode**.
- [ ] Set `STRIPE_PRICE_PREMIUM_ID` (and `STRIPE_PRICE_GOLD_ID`) as secrets.
- [ ] Set `STRIPE_SECRET_KEY` (test key) + `STRIPE_WEBHOOK_SIGN_SECRET`.
- [ ] Create the Stripe webhook endpoint → `.../functions/v1/stripe-webhook`, events: the 3 above.
- [ ] Test a checkout end-to-end in Test mode (use Stripe test card `4242 4242 4242 4242`) and confirm `profiles.subscription_tier` becomes `Premium`.
- [ ] Repeat product/price + secrets in **Live mode** with `sk_live_...` and the live `price_...` when the owner connects a live account.
- [ ] Add `STRIPE_PRICE_PREMIUM_ID` / `STRIPE_PRICE_GOLD_ID` / `APP_REDIRECT_URL` to `deploy/deploy.sh` secrets list.
