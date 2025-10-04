/**
 * Subscription Management System
 * 
 * Handles automatic subscription status checking for SeaRates API access.
 * Pricing: $9.99/month or $99/year
 * 
 * Features:
 * - Automatic Stripe integration
 * - Real-time subscription status checking
 * - Grace period handling
 * - Cancellation management
 * - Trial period support
 */

import { supabase } from './supabase';
import { State } from './state';
import { showToast } from './ui';

// Subscription pricing configuration
export const SUBSCRIPTION_PRICING = {
  monthly: {
    price: 9.99,
    currency: 'USD',
    interval: 'month',
    stripePriceId: 'price_monthly_999', // TODO: Replace with actual Stripe Price ID
  },
  yearly: {
    price: 99.00,
    currency: 'USD',
    interval: 'year',
    stripePriceId: 'price_yearly_9900', // TODO: Replace with actual Stripe Price ID
    savings: 20.88, // $119.88 - $99 = $20.88 saved
    savingsPercent: 17,
  }
};

export interface Subscription {
  id: string;
  user_id: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete';
  plan: 'monthly' | 'yearly';
  stripe_subscription_id: string;
  stripe_customer_id: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  trial_end?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Check if the current user has an active subscription
 * This is the main function used by SeaRates API calls
 */
export async function isUserSubscribed(): Promise<boolean> {
  try {
    // Check if user is logged in
    if (!State.isLoggedIn || !State.currentUser) {
      console.log('[Subscription] User not logged in');
      return false;
    }

    // Get user ID from Supabase auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return false;
    }

    // Query Supabase for active subscription
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing']) // Include trial users
      .single();

    if (error) {
      // No subscription found is not an error, just return false
      if (error.code === 'PGRST116') {
        console.log('[Subscription] No active subscription found');
        return false;
      }
      console.error('[Subscription] Error checking status:', error);
      return false;
    }

    if (!data) {
      console.log('[Subscription] No subscription data');
      return false;
    }

    // Check if subscription is not expired
    const periodEnd = new Date(data.current_period_end);
    const now = new Date();
    
    if (periodEnd < now) {
      console.log('[Subscription] Subscription expired:', periodEnd);
      return false;
    }

    // All checks passed - user has active subscription!
    console.log(`[Subscription] Active ${data.plan} subscription until ${periodEnd.toLocaleDateString()}`);
    
    // Update State with subscription info
    State.subscription = {
      isActive: true,
      plan: data.plan,
      periodEnd: data.current_period_end,
      cancelAtPeriodEnd: data.cancel_at_period_end,
    };

    return true;

  } catch (error) {
    console.error('[Subscription] Unexpected error:', error);
    return false;
  }
}

/**
 * Get detailed subscription information for the current user
 */
export async function getUserSubscription(): Promise<Subscription | null> {
  try {
    if (!State.isLoggedIn || !State.currentUser) {
      return null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No subscription found
      }
      throw error;
    }

    return data as Subscription;

  } catch (error) {
    console.error('[Subscription] Error fetching subscription:', error);
    return null;
  }
}

/**
 * Check if user is in grace period (past_due but not canceled yet)
 */
export async function isInGracePeriod(): Promise<boolean> {
  try {
    if (!State.isLoggedIn || !State.currentUser) {
      return false;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return false;
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', user.id)
      .eq('status', 'past_due')
      .single();

    if (error || !data) {
      return false;
    }

    // Give 7 days grace period after period end
    const gracePeriodEnd = new Date(data.current_period_end);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
    
    return new Date() < gracePeriodEnd;

  } catch (error) {
    console.error('[Subscription] Error checking grace period:', error);
    return false;
  }
}

/**
 * Get subscription status message for display
 */
export async function getSubscriptionStatusMessage(): Promise<string> {
  const subscription = await getUserSubscription();
  
  if (!subscription) {
    return 'No active subscription';
  }

  const periodEnd = new Date(subscription.current_period_end);
  const daysRemaining = Math.ceil((periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  switch (subscription.status) {
    case 'active':
      if (subscription.cancel_at_period_end) {
        return `Subscription cancels on ${periodEnd.toLocaleDateString()} (${daysRemaining} days remaining)`;
      }
      return `${subscription.plan === 'yearly' ? 'Yearly' : 'Monthly'} subscription active until ${periodEnd.toLocaleDateString()}`;
    
    case 'trialing':
      const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : periodEnd;
      const trialDays = Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return `Free trial - ${trialDays} days remaining`;
    
    case 'past_due':
      return '⚠️ Payment failed - Please update your payment method';
    
    case 'canceled':
      return 'Subscription canceled';
    
    case 'incomplete':
      return 'Payment incomplete - Please complete payment';
    
    default:
      return `Status: ${subscription.status}`;
  }
}

/**
 * Calculate days until subscription renewal
 */
export async function getDaysUntilRenewal(): Promise<number | null> {
  const subscription = await getUserSubscription();
  
  if (!subscription || subscription.status !== 'active') {
    return null;
  }

  const periodEnd = new Date(subscription.current_period_end);
  const daysRemaining = Math.ceil((periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  
  return daysRemaining > 0 ? daysRemaining : 0;
}

/**
 * Check if user should see upgrade prompt
 */
export async function shouldShowUpgradePrompt(): Promise<boolean> {
  // Don't show if already subscribed
  const hasSubscription = await isUserSubscribed();
  if (hasSubscription) {
    return false;
  }

  // Don't show if in grace period
  const inGracePeriod = await isInGracePeriod();
  if (inGracePeriod) {
    return false;
  }

  // Don't spam - check localStorage for last shown time
  const lastShown = localStorage.getItem('upgrade_prompt_last_shown');
  if (lastShown) {
    const daysSinceShown = (Date.now() - parseInt(lastShown)) / (1000 * 60 * 60 * 24);
    if (daysSinceShown < 3) {
      // Don't show more than once every 3 days
      return false;
    }
  }

  return true;
}

/**
 * Mark that upgrade prompt was shown (to avoid spam)
 */
export function markUpgradePromptShown(): void {
  localStorage.setItem('upgrade_prompt_last_shown', Date.now().toString());
}

/**
 * Get the reason why SeaRates API is not available
 */
export async function getAPIUnavailableReason(): Promise<string> {
  if (!State.isLoggedIn) {
    return 'Please log in to access live carrier rates';
  }

  const subscription = await getUserSubscription();
  
  if (!subscription) {
    return 'Upgrade to Premium to get real-time rates from actual carriers';
  }

  switch (subscription.status) {
    case 'past_due':
      return 'Your payment failed. Please update your payment method to restore access';
    case 'canceled':
      return 'Your subscription was canceled. Resubscribe to access live rates';
    case 'incomplete':
      return 'Please complete your payment to activate your subscription';
    default:
      return 'Subscription expired. Renew to access live carrier rates';
  }
}

/**
 * Initialize subscription state on app load
 */
export async function initializeSubscriptionState(): Promise<void> {
  if (!State.isLoggedIn || !State.currentUser) {
    State.subscription = {
      isActive: false,
      plan: null,
      periodEnd: null,
      cancelAtPeriodEnd: false,
    };
    return;
  }

  // Check subscription status
  await isUserSubscribed();
  
  console.log('[Subscription] State initialized:', State.subscription);
}

// Add subscription state to State interface
declare module './state' {
  interface StateType {
    subscription?: {
      isActive: boolean;
      plan: 'monthly' | 'yearly' | null;
      periodEnd: string | null;
      cancelAtPeriodEnd: boolean;
    };
  }
}
