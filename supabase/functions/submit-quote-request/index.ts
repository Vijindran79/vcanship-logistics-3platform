import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      serviceType,
      customerInfo,
      shipmentDetails,
      aiEstimate,
      timestamp
    } = await req.json()

    // Validate required fields
    if (!serviceType || !customerInfo || !shipmentDetails) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Store the quote request in database for tracking
    const { data: dbData, error: dbError } = await supabaseClient
      .from('quote_requests')
      .insert({
        service_type: serviceType,
        customer_email: customerInfo.email,
        customer_name: customerInfo.name,
        customer_phone: customerInfo.phone || null,
        shipment_details: shipmentDetails,
        ai_estimate: aiEstimate || null,
        status: 'pending',
        created_at: timestamp || new Date().toISOString()
      })
      .select()

    if (dbError) {
      console.error('Database error:', dbError)
      // Continue even if DB fails - email is more important
    }

    // Send email notification
    // Using a placeholder email service - you can integrate SendGrid, AWS SES, etc.
    const emailBody = `
      <h2>New Quote Request - ${serviceType}</h2>
      
      <h3>Customer Information:</h3>
      <ul>
        <li><strong>Name:</strong> ${customerInfo.name}</li>
        <li><strong>Email:</strong> ${customerInfo.email}</li>
        <li><strong>Phone:</strong> ${customerInfo.phone || 'Not provided'}</li>
      </ul>

      <h3>Shipment Details:</h3>
      <pre>${JSON.stringify(shipmentDetails, null, 2)}</pre>

      ${aiEstimate ? `
        <h3>AI-Generated Estimate:</h3>
        <pre>${JSON.stringify(aiEstimate, null, 2)}</pre>
      ` : ''}

      <h3>Request Time:</h3>
      <p>${timestamp || new Date().toISOString()}</p>

      <hr>
      <p><em>Please follow up with this customer within 24 hours with a confirmed quote from your partners.</em></p>
    `

    // TODO: Integrate with your email service
    // For now, this is a placeholder
    // You can use SendGrid, AWS SES, or any email API
    
    console.log('Email would be sent to: your-email@vcanship.com')
    console.log('Email body:', emailBody)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Quote request submitted successfully. We will contact you shortly!',
        requestId: dbData?.[0]?.id || null
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
