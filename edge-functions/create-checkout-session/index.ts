import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header for security
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Initialize Supabase Client with the user's JWT
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Retrieve user profile using the authenticated client
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse the body
    const { tier } = await req.json()
    if (!tier || !['Premium', 'Gold'].includes(tier)) {
      return new Response(JSON.stringify({ error: 'Invalid or missing tier. Must be "Premium" or "Gold"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Map pricing tiers to Price IDs (configured in Stripe dashboard)
    const priceMap: Record<string, string> = {
      Premium: Deno.env.get('STRIPE_PRICE_PREMIUM_ID') || 'price_mock_premium_1499',
      Gold: Deno.env.get('STRIPE_PRICE_GOLD_ID') || 'price_mock_gold_2999',
    }

    const priceId = priceMap[tier]

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${Deno.env.get('APP_REDIRECT_URL') || 'jodiapp://'}checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get('APP_REDIRECT_URL') || 'jodiapp://'}checkout-cancelled`,
      metadata: {
        userId: user.id,
        subscriptionTier: tier,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          subscriptionTier: tier,
        },
      },
    })

    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error(`❌ Checkout Session Error: ${err.message}`)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
