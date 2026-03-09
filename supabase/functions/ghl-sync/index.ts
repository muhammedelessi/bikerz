import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GHL_BASE_URL = 'https://services.leadconnectorhq.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const GHL_API_KEY = Deno.env.get('GHL_API_KEY')
    if (!GHL_API_KEY) {
      throw new Error('GHL_API_KEY is not configured')
    }

    const GHL_LOCATION_ID = 'ddAvdgekc94cWL9NBHK1'

    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const userId = claimsData.claims.sub as string
    const userEmail = claimsData.claims.email as string

    const { action, data } = await req.json()

    const ghlHeaders = {
      'Authorization': `Bearer ${GHL_API_KEY}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28',
    }

    switch (action) {
      case 'create_or_update_contact': {
        // Search for existing contact by email
        const searchRes = await fetch(
          `${GHL_BASE_URL}/contacts/v1/search/duplicate?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(userEmail)}`,
          { headers: ghlHeaders }
        )
        const searchData = await searchRes.json()

        const contactPayload: Record<string, unknown> = {
          locationId: GHL_LOCATION_ID,
          email: userEmail,
          name: data?.full_name || '',
          phone: data?.phone || '',
          city: data?.city || '',
          country: data?.country || '',
          postalCode: data?.postal_code || '',
          source: 'Bikerz Academy',
          tags: ['academy-student'],
          customFields: [
            { key: 'user_id', field_value: userId },
            { key: 'experience_level', field_value: data?.experience_level || '' },
            { key: 'bike_brand', field_value: data?.bike_brand || '' },
            { key: 'bike_model', field_value: data?.bike_model || '' },
          ],
        }

        let contactId: string

        if (searchData?.contact?.id) {
          // Update existing contact
          contactId = searchData.contact.id
          const updateRes = await fetch(`${GHL_BASE_URL}/contacts/v1/${contactId}`, {
            method: 'PUT',
            headers: ghlHeaders,
            body: JSON.stringify(contactPayload),
          })
          if (!updateRes.ok) {
            const errBody = await updateRes.text()
            throw new Error(`GHL update contact failed [${updateRes.status}]: ${errBody}`)
          }
          await updateRes.json()
        } else {
          // Create new contact
          const createRes = await fetch(`${GHL_BASE_URL}/contacts/v1/`, {
            method: 'POST',
            headers: ghlHeaders,
            body: JSON.stringify(contactPayload),
          })
          if (!createRes.ok) {
            const errBody = await createRes.text()
            throw new Error(`GHL create contact failed [${createRes.status}]: ${errBody}`)
          }
          const createData = await createRes.json()
          contactId = createData.contact?.id
        }

        return new Response(JSON.stringify({ success: true, contactId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'add_note': {
        // Find contact first
        const searchRes = await fetch(
          `${GHL_BASE_URL}/contacts/v1/search/duplicate?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(userEmail)}`,
          { headers: ghlHeaders }
        )
        const searchData = await searchRes.json()
        const contactId = searchData?.contact?.id

        if (!contactId) {
          return new Response(JSON.stringify({ success: false, error: 'Contact not found in GHL' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const noteRes = await fetch(`${GHL_BASE_URL}/contacts/v1/${contactId}/notes`, {
          method: 'POST',
          headers: ghlHeaders,
          body: JSON.stringify({ body: data?.note || '' }),
        })
        if (!noteRes.ok) {
          const errBody = await noteRes.text()
          throw new Error(`GHL add note failed [${noteRes.status}]: ${errBody}`)
        }
        await noteRes.json()

        // Also add tags if provided
        if (data?.tags?.length) {
          await fetch(`${GHL_BASE_URL}/contacts/v1/${contactId}/tags`, {
            method: 'POST',
            headers: ghlHeaders,
            body: JSON.stringify({ tags: data.tags }),
          })
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'track_payment': {
        // Find contact
        const searchRes = await fetch(
          `${GHL_BASE_URL}/contacts/v1/search/duplicate?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(userEmail)}`,
          { headers: ghlHeaders }
        )
        const searchData = await searchRes.json()
        const contactId = searchData?.contact?.id

        if (!contactId) {
          return new Response(JSON.stringify({ success: false, error: 'Contact not found in GHL' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Add payment note
        const paymentNote = `💰 Payment: ${data?.amount} ${data?.currency || 'SAR'} for course "${data?.course_title || 'Unknown'}". Status: ${data?.status || 'completed'}.`
        await fetch(`${GHL_BASE_URL}/contacts/v1/${contactId}/notes`, {
          method: 'POST',
          headers: ghlHeaders,
          body: JSON.stringify({ body: paymentNote }),
        })

        // Add payment tags
        await fetch(`${GHL_BASE_URL}/contacts/v1/${contactId}/tags`, {
          method: 'POST',
          headers: ghlHeaders,
          body: JSON.stringify({ tags: ['paid-student', `course-${data?.course_id || 'unknown'}`] }),
        })

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
  } catch (error: unknown) {
    console.error('GHL sync error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})