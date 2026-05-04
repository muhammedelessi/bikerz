const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/ddAvdgekc94cWL9NBHK1/webhook-trigger/f05b897f-940c-490b-8a3a-8261ab0ec064'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse the request body first
    const body = await req.json()
    const { action, data } = body

    // Check if this is a test ping (no auth required)
    if (action === 'test_ping') {
      console.log('GHL test ping - sending test data to webhook')
      
      const testPayload = {
        event: 'test_ping',
        email: 'test@bikerz.com',
        full_name: 'Test Rider - Bikerz Academy',
        phone: '+966500000000',
        city: 'Riyadh',
        country: 'Saudi Arabia',
        experience_level: 'intermediate',
        bike_brand: 'Yamaha',
        bike_model: 'MT-07',
        tags: 'test,academy-student',
        source: 'Bikerz Academy',
        timestamp: new Date().toISOString(),
      }

      const webhookRes = await fetch(GHL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      })

      const responseText = await webhookRes.text()
      console.log(`GHL test webhook response [${webhookRes.status}]: ${responseText}`)

      return new Response(JSON.stringify({ 
        success: webhookRes.ok, 
        status: webhookRes.status,
        response: responseText 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // For real actions, require authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const userId = user.id
    const userEmail = user.email || ''

    console.log(`GHL sync action: ${action}, user: ${userEmail}`)

    const webhookPayload: Record<string, unknown> = {
      event: action,
      user_id: userId,
      email: userEmail,
      timestamp: new Date().toISOString(),
      source: 'Bikerz Academy',
    }

    switch (action) {
      case 'create_or_update_contact': {
        // Split full name so GHL's "Add/Update Contact" action can
        // populate First Name + Last Name as separate columns instead
        // of leaving the contact card with just a "?" avatar.
        const safeFullName = String(data?.full_name || '').trim()
        const nameParts = safeFullName.split(/\s+/).filter(Boolean)
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ') || ''
        const dob = data?.date_of_birth || ''
        const postalCode = data?.postal_code || ''

        // Send the same data under every casing convention so GHL's
        // workflow auto-mapping picks them up no matter how the user
        // wired the contact action. See ghl.service.ts for the full
        // reasoning. The duplication is ~200 bytes and is the
        // difference between "contact created with empty fields" and
        // "contact created fully populated".
        webhookPayload.firstName = firstName
        webhookPayload.lastName = lastName
        webhookPayload.first_name = firstName
        webhookPayload.last_name = lastName
        webhookPayload.firstname = firstName
        webhookPayload.lastname = lastName
        webhookPayload.full_name = safeFullName
        webhookPayload.fullName = safeFullName
        webhookPayload.name = safeFullName

        webhookPayload.phone = data?.phone || ''
        webhookPayload.city = data?.city || ''
        webhookPayload.country = data?.country || ''
        webhookPayload.postal_code = postalCode
        webhookPayload.postalCode = postalCode
        webhookPayload.experience_level = data?.experience_level || ''
        webhookPayload.bike_brand = data?.bike_brand || ''
        webhookPayload.bike_model = data?.bike_model || ''
        webhookPayload.rider_nickname = data?.rider_nickname || ''
        webhookPayload.dateOfBirth = dob
        webhookPayload.date_of_birth = dob
        webhookPayload.gender = data?.gender || ''
        // Override email if provided in data (e.g. during signup)
        if (data?.email) webhookPayload.email = data.email
        webhookPayload.tags = 'academy-student'
        break
      }

      case 'track_payment': {
        webhookPayload.amount = data?.amount || 0
        webhookPayload.currency = data?.currency || 'SAR'
        webhookPayload.course_id = data?.course_id || ''
        webhookPayload.course_title = data?.course_title || ''
        webhookPayload.payment_status = data?.status || 'completed'
        webhookPayload.tags = 'paid-student'
        break
      }

      case 'add_note': {
        webhookPayload.note = data?.note || ''
        webhookPayload.tags = data?.tags?.join(',') || ''
        break
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    console.log('Sending to GHL webhook:', JSON.stringify(webhookPayload))

    const webhookRes = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    })

    const responseText = await webhookRes.text()
    console.log(`GHL webhook response [${webhookRes.status}]: ${responseText}`)

    if (!webhookRes.ok) {
      throw new Error(`GHL webhook failed with status ${webhookRes.status}: ${responseText}`)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('GHL sync error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
