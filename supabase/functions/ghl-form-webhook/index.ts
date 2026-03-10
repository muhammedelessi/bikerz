const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/ddAvdgekc94cWL9NBHK1/webhook-trigger/04dcd75c-2c1d-49f6-a032-0ef0d731e21d'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { full_name, email, phone, courseName, orderStatus, source, answers } = body

    const payload = {
      full_name: full_name || '',
      email: email || '',
      phone: phone || '',
      courseName: courseName || '',
      orderStatus: orderStatus || 'not purchased',
      source: source || 'direct',
      answers: typeof answers === 'object' ? JSON.stringify(answers) : (answers || ''),
      timestamp: new Date().toISOString(),
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
      throw new Error(`Webhook failed with status ${webhookRes.status}`)
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
