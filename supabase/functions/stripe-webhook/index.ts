// @ts-nocheck

// supabase/functions/stripe-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.20.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize Stripe client
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  httpClient: Stripe.createFetchHttpClient(),
});

// Get the webhook signing secret from environment variables
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET")!;

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  let receivedEvent;
  try {
    receivedEvent = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      webhookSecret,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new Response(err.message, { status: 400 });
  }
  
  // Handle the checkout.session.completed event
  if (receivedEvent.type === "checkout.session.completed") {
    const session = receivedEvent.data.object;
    const metadata = session.metadata;

    if (!metadata || !metadata.tracking_id) {
        console.error("Webhook received with missing metadata:", session.id);
        return new Response("Webhook received but metadata is missing.", { status: 400 });
    }
    
    try {
        // Create a Supabase client with the service_role key to bypass RLS
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { error } = await supabaseAdmin.from("shipments").insert({
            service: metadata.service,
            tracking_id: metadata.tracking_id,
            origin: metadata.origin,
            destination: metadata.destination,
            cost: parseFloat(metadata.cost),
            currency: metadata.currency,
            user_email: metadata.user_email,
            stripe_payment_intent: session.payment_intent, // Storing the payment intent ID for reference
        });

        if (error) {
            console.error("Supabase insert error:", error);
            throw error;
        }
        
        console.log(`Successfully logged shipment: ${metadata.tracking_id}`);

    } catch(error) {
        console.error("Error handling webhook:", error);
        return new Response("Error processing webhook.", { status: 500 });
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});