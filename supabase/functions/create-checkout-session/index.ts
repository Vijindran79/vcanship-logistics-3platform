// ⚠️  READ-ONLY — DO NOT EDIT — SERVICE LOCKED ⚠️
// @ts-nocheck

// supabase/functions/create-checkout-session/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.20.0?target=deno";

// Initialize Stripe client with the secret key from environment variables
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  // CORS headers to allow requests from your web app
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  
  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      service,
      trackingId,
      origin,
      destination,
      totalCost,
      currency,
      userEmail,
    } = await req.json();

    // Basic validation
    if (!service || !trackingId || !totalCost || !currency) {
        return new Response(JSON.stringify({ error: "Missing required shipment details." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Convert totalCost (e.g., 45.50) to the smallest currency unit (e.g., 4550 for USD)
    const amountInCents = Math.round(totalCost * 100);

    // Get success/cancel URLs from the request origin header (your app's URL)
    const successUrl = req.headers.get("origin") + "/?stripe-success=true";
    const cancelUrl = req.headers.get("origin") + "/?stripe-cancel=true";


    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `Vcanship Shipment: ${trackingId}`,
              description: `Service: ${service} | From: ${origin} To: ${destination}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Store shipment data in metadata to be retrieved by the webhook
      metadata: {
        service,
        tracking_id: trackingId,
        origin,
        destination,
        cost: totalCost,
        currency,
        user_email: userEmail || 'guest',
      },
      // If user email is available, pre-fill it in the checkout form
      ...(userEmail && { customer_email: userEmail }),
    });

    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stripe Checkout Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});