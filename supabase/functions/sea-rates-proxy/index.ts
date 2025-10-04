// Supabase Edge Function: sea-rates-proxy
// Proxies requests to SeaRates API with authentication

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SEARATES_API_KEY = Deno.env.get('SEARATES_API_KEY')
const SEARATES_BASE_URL = 'https://api.searates.com/v1'

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
    if (!SEARATES_API_KEY) {
      throw new Error('SeaRates API key not configured')
    }

    // Parse request body
    const { service, origin, destination, cargo } = await req.json()

    if (!service || !origin || !destination || !cargo) {
      throw new Error('Missing required parameters')
    }

    console.log(`🚢 SeaRates API: ${service} - ${origin.port} to ${destination.port}`)

    // Build SeaRates API endpoint based on service type
    let endpoint = ''
    let requestBody: any = {}

    switch (service) {
      case 'fcl':
        endpoint = '/shipping/fcl/rates'
        requestBody = {
          origin_port: origin.port,
          destination_port: destination.port,
          containers: cargo.containers || [{ type: '20GP', quantity: 1 }],
        }
        break

      case 'lcl':
        endpoint = '/shipping/lcl/rates'
        requestBody = {
          origin_port: origin.port,
          destination_port: destination.port,
          weight: cargo.weight,
          volume: cargo.volume,
        }
        break

      case 'air':
        endpoint = '/shipping/air/rates'
        requestBody = {
          origin_airport: origin.airport || origin.port,
          destination_airport: destination.airport || destination.port,
          weight: cargo.weight,
          volume: cargo.volume,
        }
        break

      default:
        throw new Error(`Unsupported service type: ${service}`)
    }

    const url = `${SEARATES_BASE_URL}${endpoint}`

    // Call SeaRates API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SEARATES_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error('SeaRates API error:', responseData)
      
      // Handle rate limit error specifically
      if (response.status === 429) {
        throw new Error('API rate limit reached (50 calls/month). Consider upgrading or using cached rates.')
      }
      
      throw new Error(responseData.message || 'SeaRates API request failed')
    }

    console.log(`✅ SeaRates API: Success - ${responseData.rates?.length || 0} rates returned`)

    // Return response
    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('SeaRates proxy error:', error)
    
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
