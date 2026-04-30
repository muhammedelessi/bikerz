import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // Sparse payload — only ship fields the caller actually populated.
    // Profile fields (DOB / gender) live in the dedicated profile webhook,
    // and `address` is just `city, country` — the CRM can compose it on
    // its side without us duplicating data.
    const payload: Record<string, unknown> = {
      email: email || user.email || '',
      phone: phone || '',
      full_name: full_name || '',
      city: city || '',
      country: country || '',
      source: source || 'direct',
    }
    if (courseName) payload.courseName = courseName
    if (amount) payload.amount = amount
    if (orderStatus) payload.orderStatus = orderStatus
    if (courses && courses !== '[]') payload.courses = courses
    if (typeof totalPurchased === 'number' && totalPurchased > 0) {
      payload.totalPurchased = totalPurchased
    }

    console.log('GHL form webhook payload:', JSON.stringify(payload))

    const webhookRes = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
