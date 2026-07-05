# Jodi (Saathi) Backend Deployment Guide

This directory contains the necessary scripts and configuration to deploy the Jodi app backend to a live Supabase project.

## 📋 Prerequisites

1.  **Supabase Project**: Create a new project at [supabase.com](https://supabase.com).
2.  **Environment Variables**: You will need the following from your Supabase Dashboard (Project Settings > API):
    *   `SUPABASE_URL`: Your project URL.
    *   `SUPABASE_SERVICE_ROLE_KEY`: Your service\_role secret key (Keep this private!).
    *   `DATABASE_URL`: Your Postgres connection string (Settings > Database).
3.  **Third-Party Keys**:
    *   `STRIPE_SECRET_KEY`: From your Stripe Dashboard.
    *   `STRIPE_WEBHOOK_SIGN_SECRET`: Generated when you create a webhook endpoint in Stripe.
    *   `OPENAI_API_KEY`: (Optional) For AI icebreaker generation.

## 🚀 Deployment Steps

### 1. Database Migration

The consolidated migration script set up the schema, RLS policies, functions, and triggers.

**Option A: Using the Supabase Dashboard (Recommended)**
1.  Open your Supabase Project Dashboard.
2.  Go to the **SQL Editor**.
3.  Click **New Query**.
4.  Copy the entire contents of `supabase_migration.sql` and paste it into the editor.
5.  Click **Run**.

**Option B: Using the Deployment Script**
If you have `psql` installed locally:
```bash
export SUPABASE_URL="your-project-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export DATABASE_URL="your-postgres-connection-string"
./deploy.sh
```

### 2. Edge Functions Deployment

Deploy the edge functions using the Supabase CLI:

```bash
# Install Supabase CLI if you haven't
# brew install supabase/tap/supabase

# Login
supabase login

# Initialize (if first time)
# supabase init

# Deploy each function
supabase functions deploy stripe-webhook
supabase functions deploy create-checkout-session
supabase functions deploy ai-icebreaker
supabase functions deploy selfie-moderation
```

### 3. Set Edge Function Secrets

Ensure the functions have access to required API keys:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SIGN_SECRET=whsec_...
supabase secrets set OPENAI_API_KEY=sk-proj-...
```

### 4. Configure Stripe Webhooks

1.  Go to the **Stripe Dashboard > Developers > Webhooks**.
2.  Add an endpoint pointing to: `https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook`.
3.  Select events: `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated`.

## 🛠 Troubleshooting

*   **RLS Violations**: If you see permission errors in the app, verify that the policies in `supabase_migration.sql` were applied correctly.
*   **Edge Function Timeouts**: Ensure you are on a Supabase plan that supports the required execution time or optimize the code.
*   **Stripe Matching**: Ensure the `price_id` in your Stripe product matches the logic in the edge functions.

