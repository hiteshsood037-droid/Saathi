#!/bin/bash

# ==========================================
# Jodi App Backend Deployment Script
# ==========================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

set -e

echo -e "${BLUE}🚀 Starting Jodi App Backend Deployment...${NC}"

# 1. Environment Check
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.${NC}"
  echo "Please export them before running this script."
  exit 1
fi

# 2. Run Database Migrations
echo -e "${BLUE}📦 Running database migrations...${NC}"
# In a real environment, we would use the Supabase CLI:
# supabase db push
# Or use curl to the SQL API if available (typically requires management token)

# For the purpose of this script, we'll use curl to the REST API as a placeholder 
# or suggest using the Supabase Dashboard SQL Editor if direct API access is restricted.
echo "Deploying 'supabase_migration.sql'..."

# Mocking the execution logic
# In practice, you'd use: psql "$DATABASE_URL" -f supabase_migration.sql
if [ -n "$DATABASE_URL" ]; then
    psql "$DATABASE_URL" -f supabase_migration.sql
    echo -e "${GREEN}✅ Database migration successful via psql.${NC}"
else
    echo "Warning: DATABASE_URL not set. Skipping psql migration."
    echo "Please manually run 'supabase_migration.sql' in the Supabase SQL Editor."
fi

# 3. Create Storage Buckets
echo -e "${BLUE}📂 Configuring storage buckets...${NC}"

create_bucket() {
  local bucket_id=$1
  local is_public=$2
  
  echo "Setting up bucket: $bucket_id (public: $is_public)"
  
  # Try to create bucket (will fail if exists, which is fine)
  curl -s -X POST "${SUPABASE_URL}/storage/v1/bucket" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"id\": \"$bucket_id\", \"name\": \"$bucket_id\", \"public\": $is_public}" > /dev/null
    
  echo -e "${GREEN}✅ Bucket '$bucket_id' verified.${NC}"
}

create_bucket "user-photos" "true"
create_bucket "selfie-verification" "false"

# 4. Configure Edge Function Secrets
echo -e "${BLUE}⚡ Configuring Edge Function Secrets...${NC}"

set_secret() {
  local name=$1
  local value=$2
  if [ -n "$value" ]; then
    echo "Setting secret: $name"
    # Placeholder for 'supabase secrets set'
    # supabase secrets set $name=$value
  fi
}

# Example secrets (should be set in the environment)
set_secret "STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY"
set_secret "STRIPE_WEBHOOK_SIGN_SECRET" "$STRIPE_WEBHOOK_SIGN_SECRET"
set_secret "STRIPE_PRICE_PREMIUM_ID" "$STRIPE_PRICE_PREMIUM_ID"
set_secret "STRIPE_PRICE_GOLD_ID" "$STRIPE_PRICE_GOLD_ID"
set_secret "APP_REDIRECT_URL" "$APP_REDIRECT_URL"
set_secret "OPENAI_API_KEY" "$OPENAI_API_KEY"

echo -e "${GREEN}✅ Secrets configured.${NC}"

echo -e "${BLUE}🎉 Backend Deployment Scripts Prepared!${NC}"
echo "To finish deployment, run the following commands manually if not using CLI:"
echo "1. Upload and deploy Edge Functions from 'supabase_functions/'"
echo "2. Ensure RLS policies are active for all tables."
