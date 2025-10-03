// api-usage-integration.ts
// Integrates the API usage tracker into the application UI

import { renderAPIUsageBadge, renderAPIUsageWidget, showAPIUsageModal } from './api-usage-tracker';
import { isUserSubscribed } from './subscription';

/**
 * Initialize API usage tracking in the application
 * Now only shown for Premium subscribers (free users don't use SeaRates API)
 */
export async function initializeAPIUsageTracking(): Promise<void> {
    // Only show for Premium users who have access to SeaRates API
    const hasSubscription = await isUserSubscribed();
    
    if (!hasSubscription) {
        console.log('ℹ️ API usage badge hidden for free users (AI estimates only)');
        return;
    }
    
    // Add badge to header for Premium users only
    const headerUserActions = document.querySelector('.header-user-actions');
    
    if (headerUserActions) {
        // Create container for API usage badge
        const badgeContainer = document.createElement('div');
        badgeContainer.id = 'api-usage-badge-container';
        badgeContainer.style.cssText = 'display: inline-block; margin-right: 0.5rem;';
        
        // Insert before the region-language button
        const regionBtn = document.getElementById('region-language-btn');
        if (regionBtn) {
            headerUserActions.insertBefore(badgeContainer, regionBtn);
            renderAPIUsageBadge('api-usage-badge-container');
            
            // Add click handler to show modal
            badgeContainer.addEventListener('click', () => {
                showAPIUsageModal();
            });
        }
    }
    
    // Add widget to dashboard if container exists
    addDashboardWidget();
    
    console.log('✅ API usage tracking initialized');
}

/**
 * Add API usage widget to dashboard
 */
function addDashboardWidget(): void {
    // Try to find dashboard content area
    const dashboardPage = document.getElementById('page-dashboard');
    
    if (dashboardPage) {
        // Create widget container
        const widgetContainer = document.createElement('div');
        widgetContainer.id = 'api-usage-widget-container';
        
        // Insert at the top of dashboard
        const ecomHub = dashboardPage.querySelector('.dashboard-ecom-hub');
        if (ecomHub) {
            dashboardPage.insertBefore(widgetContainer, ecomHub);
            renderAPIUsageWidget('api-usage-widget-container');
        }
    }
}

/**
 * Refresh API usage display (call after making API calls)
 * Only refreshes if user is Premium subscriber
 */
export async function refreshAPIUsageDisplay(): Promise<void> {
    const hasSubscription = await isUserSubscribed();
    
    if (!hasSubscription) {
        return; // Free users don't have badge to refresh
    }
    
    // Refresh badge
    const badgeContainer = document.getElementById('api-usage-badge-container');
    if (badgeContainer) {
        renderAPIUsageBadge('api-usage-badge-container');
    }
    
    // Refresh widget if it exists
    const widgetContainer = document.getElementById('api-usage-widget-container');
    if (widgetContainer) {
        renderAPIUsageWidget('api-usage-widget-container');
    }
}
