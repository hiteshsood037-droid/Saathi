import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

// Optional provider key (Sightengine / Hive / etc.)
const MODERATION_API_KEY = Deno.env.get('MODERATION_API_KEY') || ''

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
    const { userId, photoUrl } = await req.json()
    if (!userId || !photoUrl) {
      return new Response(JSON.stringify({ error: 'Missing userId or photoUrl' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`🖼️ Running photo moderation for User ${userId}: ${photoUrl}`)

    // ============================================================
    // PRODUCTION INTEGRATION POINT
    // Call an image-safety provider here, e.g.:
    //   - AWS Rekognition DetectModerationLabels
    //   - Google Cloud Vision SafeSearch
    //   - Sightengine / Hive Moderation
    // and derive a moderation_score (0.00 safe → 1.00 inappropriate)
    // plus an auto status.
    // ============================================================
    // For this scaffold we simulate a provider response.
    const mockScore = Math.random() // 0 → 1
    const isSafe = mockScore < 0.85 // 85% of photos pass in the mock
    const status = isSafe ? 'approved' : 'pending'
    const moderationScore = Number(mockScore.toFixed(2))

    const { error } = await supabase
      .from('photo_moderation')
      .insert({
        user_id: userId,
        photo_url: photoUrl,
        status,
        moderation_score: moderationScore,
      })

    if (error) {
      console.error(`❌ DB Error writing photo moderation: ${error.message}`)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`✅ Photo moderation queued. Status: ${status}, Score: ${moderationScore}`)
    return new Response(JSON.stringify({
      success: true,
      status,
      moderationScore,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
