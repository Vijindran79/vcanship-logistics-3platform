/**
 * Stripe Webhook Handler - Automatic Subscription Management
 * 
 * Listens to Stripe webhook events and automatically updates the subscriptions table.
 * 
 * Handled events:
 * - customer.subscription.created: New subscription
 * - customer.subscription.updated: Status change, renewal, cancellation
 * - customer.subscription.deleted: Subscription ended
 * - invoice.payment_succeeded: Successful payment, extend period
 * - invoice.payment_failed: Failed payment, mark past_due
 * 
 * Deploy: supabase functions deploy stripe-subscription-webhook
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'stripe-signature, content-type',
      },
    });
  }

  try {
    // Verify webhook signature
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response('Missing stripe-signature header', { status: 400 });
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('⚠️ Webhook signature verification failed:', err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    console.log('✅ Webhook received:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Handle subscription created or updated
 */
async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  console.log('Processing subscription:', subscription.id);

  // Get user_id from metadata (must be set when creating subscription)
  const userId = subscription.metadata?.user_id;
  if (!userId) {
    console.error('❌ No user_id in subscription metadata');
    return;
  }

  // Determine plan from price
  const priceId = subscription.items.data[0]?.price.id;
  let plan: 'monthly' | 'yearly' = 'monthly';
  
  if (priceId?.includes('yearly') || subscription.items.data[0]?.price.recurring?.interval === 'year') {
    plan = 'yearly';
  }

  // Prepare subscription data
  const subscriptionData = {
    user_id: userId,
    status: subscription.status,
    plan: plan,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    stripe_price_id: priceId,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  // Upsert subscription (insert or update)
  const { error } = await supabase
    .from('subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'stripe_subscription_id',
    });

  if (error) {
    console.error('❌ Error upserting subscription:', error);
  } else {
    console.log(`✅ Subscription ${subscription.id} saved (${plan}, status: ${subscription.status})`);
  }
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Deleting subscription:', subscription.id);

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('❌ Error updating canceled subscription:', error);
  } else {
    console.log(`✅ Subscription ${subscription.id} marked as canceled`);
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!invoice.subscription) {
    return; // Not a subscription invoice
  }

  console.log('Payment succeeded for subscription:', invoice.subscription);

  // Fetch the subscription to get updated period
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('❌ Error updating subscription after payment:', error);
  } else {
    console.log(`✅ Subscription ${subscription.id} renewed until ${new Date(subscription.current_period_end * 1000).toLocaleDateString()}`);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) {
    return; // Not a subscription invoice
  }

  console.log('Payment failed for subscription:', invoice.subscription);

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', invoice.subscription as string);

  if (error) {
    console.error('❌ Error marking subscription as past_due:', error);
  } else {
    console.log(`⚠️ Subscription ${invoice.subscription} marked as past_due`);
  }
}
