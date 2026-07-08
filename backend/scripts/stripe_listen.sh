#!/usr/bin/env bash
# Stripe webhook local — copie whsec_... dans backend/.env (STRIPE_WEBHOOK_SECRET)
set -euo pipefail
cd "$(dirname "$0")/.."
echo "→ Forward webhooks vers http://localhost:8000/api/webhook/stripe"
echo "→ Copie le whsec_... affiché dans STRIPE_WEBHOOK_SECRET (backend/.env)"
stripe listen --forward-to localhost:8000/api/webhook/stripe
