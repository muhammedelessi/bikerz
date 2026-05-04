import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { coerceToCountryCode } from '../_shared/countryCodeMap.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/ddAvdgekc94cWL9NBHK1/webhook-trigger/9a3cf7c3-0405-4667-ad02-e9c89073feb4'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Require authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { full_name, email, phone, city, country, courseName, amount, orderStatus, source, courses, totalPurchased } = body

    // Coerce to ISO 2-letter code regardless of how the caller passed
    // the country (already a code, English name, Arabic name, or alias).
    // Covers all 249 ISO 3166-1 alpha-2 codes — see
    // _shared/countryCodeMap.ts for the full mapping.
    const countryCode = coerceToCountryCode(country)

    // Tight 11-field payload per the agreed order-webhook spec. No
    // firstName/lastName splits, no address1, no DOB/gender — those
    // belong on the profile webhook.
    const payload: Record<string, unknown> = {
      email: email || user.email || '',
      full_name: full_name || '',
      phone: phone || '',
      country: countryCode,
      city: city || '',
      source: source || 'direct',
      courseName: courseName || '',
      amount: amount || '',
      orderStatus: orderStatus || 'not purchased',
      totalPurchased: totalPurchased ?? 0,
      courses: courses || '[]',
    }

    console.log('GHL form webhook payload:', JSON.stringify(payload))

    const webhookRes = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      // charset=utf-8 explicit so GHL decodes Arabic correctly.
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })

    const responseText = await webhookRes.text()
    console.log(`GHL form webhook response [${webhookRes.status}]: ${responseText}`)

    if (!webhookRes.ok) {
      console.warn(`GHL webhook returned non-OK status ${webhookRes.status}, continuing gracefully`)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('GHL form webhook error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
