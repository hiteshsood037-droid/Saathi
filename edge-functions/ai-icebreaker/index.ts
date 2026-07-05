import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { matchedUserId } = await req.json()
    if (!matchedUserId) {
      return new Response(JSON.stringify({ error: 'Missing matchedUserId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Retrieve both profiles
    const { data: profiles, error: dbError } = await supabase
      .from('profiles')
      .select('full_name, birth_date, religion, languages_spoken, diet, occupation, bio')
      .in('id', [user.id, matchedUserId])

    if (dbError || !profiles || profiles.length < 2) {
      return new Response(JSON.stringify({ error: 'Failed to retrieve match profiles' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const myProfile = profiles.find((p: any) => p.full_name !== profiles[1].full_name) || profiles[0]
    const matchProfile = profiles.find((p: any) => p.full_name === profiles[1].full_name) || profiles[1]

    // South Asian customized static fallback / AI hybrid logic
    // (If OpenAI / Gemini / Claude API was available, we would call it here)
    const prompts = [
      `Hi ${matchProfile.full_name}! Since we both speak ${matchProfile.languages_spoken?.[0] || 'the same language'} and enjoy a ${matchProfile.diet} diet, what's your ultimate comfort food?`,
      `Hey ${matchProfile.full_name}, I saw you work as a ${matchProfile.occupation || 'professional'}. How do you balance that with your hobbies?`,
      `Namaste ${matchProfile.full_name}! If you could travel to any place in India right now, would you choose the beaches of Goa or the mountains of Shimla?`,
      `Hello ${matchProfile.full_name}! What's your absolute favorite family recipe or holiday tradition?`,
    ]

    // Select random prompt
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)]

    return new Response(JSON.stringify({ icebreaker: randomPrompt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
