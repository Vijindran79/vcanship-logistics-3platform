// Supabase Edge Function: shippo-proxy
// Proxies requests to Shippo API with authentication

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SHIPPO_API_KEY = Deno.env.get('SHIPPO_LIVE_API_KEY')
const SHIPPO_BASE_URL = 'https://api.goshippo.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify API key is configured
    if (!SHIPPO_API_KEY) {
      throw new Error('Shippo API key not configured')
    }

    // Parse request body
    const { endpoint, method = 'GET', data } = await req.json()

    if (!endpoint) {
      throw new Error('Endpoint is required')
    }

    // Build Shippo API URL
    const url = `${SHIPPO_BASE_URL}${endpoint}`

    // Prepare request options
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `ShippoToken ${SHIPPO_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }

    // Add body for POST/PUT requests
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data)
    }

    console.log(`🚀 Shippo API: ${method} ${endpoint}`)

    // Call Shippo API
    const response = await fetch(url, options)
    const responseData = await response.json()

    if (!response.ok) {
      console.error('Shippo API error:', responseData)
      throw new Error(responseData.detail || 'Shippo API request failed')
    }

    console.log(`✅ Shippo API: Success`)

    // Return response
    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('Shippo proxy error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
