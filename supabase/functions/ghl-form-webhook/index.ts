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
    const { full_name, email, phone, city, country, address, courseName, amount, orderStatus, source, courses, totalPurchased, dateOfBirth, gender } = body

    // Split full name into first/last so GHL's "Add/Update Contact"
    // action can populate the First Name + Last Name columns separately.
    const safeFullName = String(full_name || '').trim()
    const nameParts = safeFullName.split(/\s+/).filter(Boolean)
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    // Send the same data under every common field-name convention so
    // GHL's workflow auto-mapping picks them up regardless of how the
    // workflow was wired. Without this, contacts showed up in GHL with
    // "?" avatars and dashes for name/email/phone (the workflow created
    // them but couldn't bind any field).
    const payload: Record<string, unknown> = {
      // ── Name (every casing) ──
      firstName,
      lastName,
      first_name: firstName,
      last_name: lastName,
      firstname: firstName,
      lastname: lastName,
      full_name: safeFullName,
      fullName: safeFullName,
      name: safeFullName,

      // ── Contact ──
      email: email || user.email || '',
      phone: phone || '',

      // ── Address (GHL uses address1, NOT address) ──
      address1: address || '',
      address: address || '',
      city: city || '',
      country: country || '',

      // ── Personal ──
      dateOfBirth: dateOfBirth || '',
      date_of_birth: dateOfBirth || '',
      gender: gender || '',

      // ── Order / context ──
      courseName: courseName || '',
      amount: amount || '',
      source: source || 'direct',
      orderStatus: orderStatus || 'not purchased',
      courses: courses || '[]',
      totalPurchased: totalPurchased ?? 0,
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
