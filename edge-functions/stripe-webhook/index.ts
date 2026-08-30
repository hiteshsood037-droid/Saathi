import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

// Initialize Stripe with secret key
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
})

// Initialize Supabase Client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SIGN_SECRET') || ''

// Subscription statuses that keep a paid tier active. Any other status
// (past_due, unpaid, canceled, incomplete, incomplete_expired) downgrades
// the user back to Free so a lapsed card doesn't keep premium access.
const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing']

function resolveTier(status: string | undefined, requestedTier: string): string {
  return ACTIVE_SUBSCRIPTION_STATUSES.includes(status ?? '') ? requestedTier : 'Free'
}

serve(async (req) => {
  const { method } = req

  if (method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
      },
    })
  }

  if (method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const signature = req.headers.get('Stripe-Signature')
  if (!signature) {
    return new Response('Missing Stripe-Signature', { status: 400 })
  }

  try {
    const body = await req.text()
    let event: any

    if (endpointSecret) {
      event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret)
    } else {
      event = JSON.parse(body)
    }

    console.log(`🔔 Received event: ${event.type}`)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.metadata?.userId
        const subscriptionId = session.subscription
        const requestedTier = session.metadata?.subscriptionTier || 'Premium' // Default to Premium if unspecified

        if (!userId) {
          console.error('❌ Missing userId in checkout session metadata.')
          break
        }

        // Retrieve subscription details from Stripe to get precise end date
        const subscription = await stripe.subscriptions.retrieve(subscriptionId as string)
        const endsAt = new Date(subscription.current_period_end * 1000).toISOString()
        const tier = resolveTier(subscription.status, requestedTier)

        // Call our PostgreSQL function to update subscription tier securely
        const { error } = await supabase.rpc('handle_stripe_subscription_update', {
          p_user_id: userId,
          p_tier: tier,
          p_ends_at: tier === 'Free' ? null : endsAt,
        })

        if (error) {
          console.error(`❌ DB Update Error: ${error.message}`)
          return new Response(`Database update failed: ${error.message}`, { status: 500 })
        }

        console.log(`✅ Subscription created successfully for User ${userId} (${tier})`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const userId = subscription.metadata?.userId
        const requestedTier = subscription.metadata?.subscriptionTier || 'Premium'
        const endsAt = new Date(subscription.current_period_end * 1000).toISOString()

        if (!userId) {
          console.error('❌ Missing userId in subscription metadata.')
          break
        }

        // Downgrade to Free when the subscription lapses (past_due/unpaid/etc.);
        // the same event re-grants the tier when it returns to active/trialing.
        const tier = resolveTier(subscription.status, requestedTier)

        const { error } = await supabase.rpc('handle_stripe_subscription_update', {
          p_user_id: userId,
          p_tier: tier,
          p_ends_at: tier === 'Free' ? null : endsAt,
        })

        if (error) {
          console.error(`❌ DB Update Error: ${error.message}`)
          return new Response(`Database update failed: ${error.message}`, { status: 500 })
        }

        console.log(`✅ Subscription updated successfully for User ${userId} (${tier})`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const userId = subscription.metadata?.userId

        if (!userId) {
          console.error('❌ Missing userId in subscription metadata.')
          break
        }

        // Revoke subscription, setting tier back to 'Free'
        const { error } = await supabase.rpc('handle_stripe_subscription_update', {
          p_user_id: userId,
          p_tier: 'Free',
          p_ends_at: null,
        })

        if (error) {
          console.error(`❌ DB Update Error: ${error.message}`)
          return new Response(`Database update failed: ${error.message}`, { status: 500 })
        }

        console.log(`✅ Subscription cancelled/deleted successfully for User ${userId}`)
        break
      }

      default:
        console.log(`Unhandled event type ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error(`⚠️ Webhook signature verification failed: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})
