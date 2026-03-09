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

    const { action, data } = await req.json()

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
        webhookPayload.full_name = data?.full_name || ''
        webhookPayload.phone = data?.phone || ''
        webhookPayload.city = data?.city || ''
        webhookPayload.country = data?.country || ''
        webhookPayload.postal_code = data?.postal_code || ''
        webhookPayload.experience_level = data?.experience_level || ''
        webhookPayload.bike_brand = data?.bike_brand || ''
        webhookPayload.bike_model = data?.bike_model || ''
        webhookPayload.rider_nickname = data?.rider_nickname || ''
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
