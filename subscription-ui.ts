/**
 * Subscription Upgrade UI Component
 * 
 * Shows pricing modal to free users encouraging upgrade to Premium.
 * Displays benefits, pricing ($9.99/month, $99/year), and Stripe checkout.
 */

import { State } from './state';
import { SUBSCRIPTION_PRICING, shouldShowUpgradePrompt, markUpgradePromptShown } from './subscription';

/**
 * Show subscription upgrade modal
 */
export function showSubscriptionUpgradeModal(context: 'fcl' | 'lcl' | 'airfreight' = 'fcl'): void {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.id = 'subscription-upgrade-modal';
  
  const serviceNames = {
    fcl: 'FCL container shipping',
    lcl: 'LCL ocean freight',
    airfreight: 'air freight'
  };
  
  const serviceName = serviceNames[context];
  
  modal.innerHTML = `
    <div class="modal-content subscription-upgrade-modal">
      <button class="modal-close" id="close-upgrade-modal">&times;</button>
      
      <div class="upgrade-header">
        <div class="upgrade-icon">🚀</div>
        <h2>Upgrade to Premium</h2>
        <p class="upgrade-subtitle">Get real-time rates from actual carriers</p>
      </div>
      
      <div class="upgrade-comparison">
        <div class="plan-column current-plan">
          <div class="plan-badge">Current Plan</div>
          <h3>Free</h3>
          <div class="plan-price">$0<span>/month</span></div>
          <ul class="plan-features">
            <li class="feature-disabled">❌ AI-estimated quotes only</li>
            <li class="feature-disabled">❌ Rates may not reflect actual costs</li>
            <li class="feature-disabled">❌ Manual follow-up required</li>
            <li class="feature-enabled">✅ Unlimited Parcel quotes (Shippo)</li>
            <li class="feature-enabled">✅ Access to all services</li>
          </ul>
        </div>
        
        <div class="plan-column premium-plan">
          <div class="plan-badge popular">⭐ Most Popular</div>
          <h3>Premium</h3>
          <div class="plan-price">$9.99<span>/month</span></div>
          <ul class="plan-features">
            <li class="feature-enabled">✅ Real-time carrier rates</li>
            <li class="feature-enabled">✅ Maersk, MSC, CMA CGM quotes</li>
            <li class="feature-enabled">✅ Live ${serviceName} pricing</li>
            <li class="feature-enabled">✅ 24-hour rate validity</li>
            <li class="feature-enabled">✅ Accurate transit times</li>
            <li class="feature-enabled">✅ Save hours on manual quotes</li>
            <li class="feature-enabled">✅ Priority customer support</li>
            <li class="feature-enabled">✅ Unlimited Parcel quotes (Shippo)</li>
          </ul>
          <button class="btn-primary upgrade-btn" data-plan="monthly">
            Subscribe Monthly - $9.99/mo
          </button>
        </div>
        
        <div class="plan-column yearly-plan">
          <div class="plan-badge savings">💰 Save 17%</div>
          <h3>Premium Yearly</h3>
          <div class="plan-price">$99<span>/year</span></div>
          <div class="savings-note">Save $20.88 vs monthly!</div>
          <ul class="plan-features">
            <li class="feature-enabled">✅ Everything in Monthly</li>
            <li class="feature-enabled">✅ <strong>2 months FREE</strong></li>
            <li class="feature-enabled">✅ Best value for frequent shippers</li>
            <li class="feature-enabled">✅ Annual billing ($99 once/year)</li>
          </ul>
          <button class="btn-primary upgrade-btn" data-plan="yearly">
            Subscribe Yearly - $99/yr
          </button>
        </div>
      </div>
      
      <div class="upgrade-footer">
        <p class="footer-note">✨ Cancel anytime • No hidden fees • Instant activation</p>
        <p class="footer-note">🔒 Secure payment powered by Stripe</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Mark that we showed the prompt
  markUpgradePromptShown();
  
  // Close button
  const closeBtn = document.getElementById('close-upgrade-modal');
  closeBtn?.addEventListener('click', () => {
    modal.remove();
  });
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  // Upgrade buttons
  const upgradeButtons = modal.querySelectorAll('.upgrade-btn');
  upgradeButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const plan = (e.target as HTMLElement).getAttribute('data-plan') as 'monthly' | 'yearly';
      await handleSubscriptionCheckout(plan);
    });
  });
}

/**
 * Show compact upgrade banner (less intrusive than modal)
 */
export function showSubscriptionUpgradeBanner(context: 'fcl' | 'lcl' | 'airfreight'): void {
  // Check if banner already exists
  if (document.getElementById('subscription-upgrade-banner')) {
    return;
  }
  
  const banner = document.createElement('div');
  banner.id = 'subscription-upgrade-banner';
  banner.className = 'subscription-upgrade-banner';
  
  const serviceEmojis = {
    fcl: '🚢',
    lcl: '📦',
    airfreight: '✈️'
  };
  
  banner.innerHTML = `
    <div class="banner-content">
      <span class="banner-icon">${serviceEmojis[context]}</span>
      <div class="banner-text">
        <strong>💡 Upgrade to Premium</strong>
        <span>Get real-time carrier rates for just $9.99/month</span>
      </div>
      <button class="btn-primary btn-sm" id="banner-upgrade-btn">Upgrade Now</button>
      <button class="banner-close" id="banner-close-btn">&times;</button>
    </div>
  `;
  
  // Insert banner at the top of the results section
  const resultsSection = document.querySelector('#fcl-step-4, #lcl-quote-container, #airfreight-quote-container');
  if (resultsSection) {
    resultsSection.insertBefore(banner, resultsSection.firstChild);
  }
  
  // Upgrade button
  const upgradeBtn = document.getElementById('banner-upgrade-btn');
  upgradeBtn?.addEventListener('click', () => {
    showSubscriptionUpgradeModal(context);
  });
  
  // Close button
  const closeBtn = document.getElementById('banner-close-btn');
  closeBtn?.addEventListener('click', () => {
    banner.remove();
  });
}

/**
 * Handle Stripe checkout for subscription
 */
async function handleSubscriptionCheckout(plan: 'monthly' | 'yearly'): Promise<void> {
  try {
    // Show loading state
    const buttons = document.querySelectorAll('.upgrade-btn');
    buttons.forEach(btn => {
      (btn as HTMLButtonElement).disabled = true;
      (btn as HTMLButtonElement).textContent = 'Processing...';
    });
    
    // Check if user is logged in
    if (!State.isLoggedIn) {
      alert('Please log in first to subscribe.');
      // Redirect to login
      window.location.hash = '#auth';
      return;
    }
    
    // Get price ID based on plan
    const priceId = plan === 'monthly' 
      ? SUBSCRIPTION_PRICING.monthly.stripePriceId 
      : SUBSCRIPTION_PRICING.yearly.stripePriceId;
    
    // TODO: Integrate with Stripe Checkout
    // For now, redirect to a placeholder payment page
    // In production, this will create a Stripe checkout session for subscriptions
    
    console.log(`[Subscription] Creating checkout for ${plan} plan at ${priceId}`);
    
    // Placeholder: Show success message for now
    alert(`Subscription checkout ready for ${plan} plan!\n\nIn production, this will redirect to Stripe Checkout.\n\nPrice ID: ${priceId}\nPlan: ${plan === 'monthly' ? '$9.99/month' : '$99/year'}`);
    
    // Close the modal
    document.getElementById('subscription-upgrade-modal')?.remove();
    
  } catch (error) {
    console.error('[Subscription] Checkout error:', error);
    alert('Failed to start subscription checkout. Please try again.');
    
    // Reset buttons
    const buttons = document.querySelectorAll('.upgrade-btn');
    buttons.forEach(btn => {
      (btn as HTMLButtonElement).disabled = false;
      const plan = (btn as HTMLElement).getAttribute('data-plan');
      (btn as HTMLButtonElement).textContent = plan === 'yearly' 
        ? 'Subscribe Yearly - $99/yr' 
        : 'Subscribe Monthly - $9.99/mo';
    });
  }
}

/**
 * Auto-show upgrade prompt if appropriate
 */
export async function maybeShowUpgradePrompt(context: 'fcl' | 'lcl' | 'airfreight'): Promise<void> {
  const shouldShow = await shouldShowUpgradePrompt();
  
  if (shouldShow) {
    // Use banner instead of modal for less intrusion
    showSubscriptionUpgradeBanner(context);
  }
}

/**
 * Add inline upgrade CTA to quote results
 */
export function addUpgradeCTAToQuote(quoteContainer: HTMLElement, context: 'fcl' | 'lcl' | 'airfreight'): void {
  const cta = document.createElement('div');
  cta.className = 'inline-upgrade-cta';
  cta.innerHTML = `
    <div class="cta-content">
      <div class="cta-icon">🎯</div>
      <div class="cta-text">
        <strong>This is an AI estimate</strong>
        <p>Upgrade to Premium to get real-time rates from actual carriers</p>
      </div>
      <button class="btn-primary" id="inline-upgrade-btn">
        Upgrade to Premium - $9.99/mo
      </button>
    </div>
  `;
  
  quoteContainer.appendChild(cta);
  
  // Click handler
  const upgradeBtn = document.getElementById('inline-upgrade-btn');
  upgradeBtn?.addEventListener('click', () => {
    showSubscriptionUpgradeModal(context);
  });
}
