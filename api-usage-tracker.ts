// api-usage-tracker.ts
// UI component for displaying SeaRates API usage statistics

const MONTHLY_LIMIT = 50;

/**
 * Get current month's API usage
 */
export function getAPIUsage(): { used: number; remaining: number; percentage: number } {
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    const key = `searates_calls_${currentMonth}`;
    
    const used = parseInt(localStorage.getItem(key) || '0', 10);
    const remaining = MONTHLY_LIMIT - used;
    const percentage = (used / MONTHLY_LIMIT) * 100;
    
    return { used, remaining, percentage };
}

/**
 * Get status level based on usage
 */
function getUsageStatus(percentage: number): 'good' | 'warning' | 'critical' {
    if (percentage >= 80) return 'critical';
    if (percentage >= 60) return 'warning';
    return 'good';
}

/**
 * Render API usage widget for dashboard
 */
export function renderAPIUsageWidget(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }
    
    const usage = getAPIUsage();
    const status = getUsageStatus(usage.percentage);
    
    const statusColors = {
        good: '#10b981',
        warning: '#f59e0b',
        critical: '#ef4444'
    };
    
    const statusMessages = {
        good: 'Healthy API usage',
        warning: 'Approaching limit',
        critical: 'Critical - Near limit!'
    };
    
    container.innerHTML = `
        <div class="api-usage-widget" style="
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 1.5rem;
            margin: 1rem 0;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h4 style="margin: 0; font-size: 1rem; color: var(--text-color);">
                    📊 SeaRates API Usage
                </h4>
                <span style="
                    background: ${statusColors[status]}22;
                    color: ${statusColors[status]};
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 600;
                ">${statusMessages[status]}</span>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    margin-bottom: 0.5rem;
                ">
                    <span style="font-size: 2rem; font-weight: 700; color: var(--text-color);">
                        ${usage.used}
                    </span>
                    <span style="font-size: 0.875rem; color: var(--text-muted);">
                        of ${MONTHLY_LIMIT} calls used
                    </span>
                </div>
                
                <div style="
                    width: 100%;
                    height: 8px;
                    background: var(--light-gray);
                    border-radius: 4px;
                    overflow: hidden;
                    position: relative;
                ">
                    <div style="
                        width: ${usage.percentage}%;
                        height: 100%;
                        background: linear-gradient(to right, ${statusColors[status]}, ${statusColors[status]}dd);
                        border-radius: 4px;
                        transition: width 0.3s ease;
                    "></div>
                </div>
            </div>
            
            <div style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1rem;
                padding-top: 1rem;
                border-top: 1px solid var(--border-color);
            ">
                <div>
                    <p style="margin: 0; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">
                        Remaining
                    </p>
                    <p style="margin: 0; font-size: 1.25rem; font-weight: 600; color: var(--text-color);">
                        ${usage.remaining}
                    </p>
                </div>
                <div>
                    <p style="margin: 0; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">
                        Resets
                    </p>
                    <p style="margin: 0; font-size: 1.25rem; font-weight: 600; color: var(--text-color);">
                        ${getResetDate()}
                    </p>
                </div>
            </div>
            
            ${usage.remaining <= 5 ? `
                <div style="
                    margin-top: 1rem;
                    padding: 0.75rem;
                    background: ${statusColors.critical}15;
                    border-left: 3px solid ${statusColors.critical};
                    border-radius: 4px;
                ">
                    <p style="margin: 0; font-size: 0.875rem; color: var(--text-color);">
                        ⚠️ <strong>Low API Credits:</strong> Switching to AI estimates soon. 
                        Contact sales to upgrade your plan.
                    </p>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Get the date when API quota resets (first day of next month)
 */
function getResetDate(): string {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return nextMonth.toLocaleDateString('en-US', options);
}

/**
 * Render compact API usage badge (for header/navbar)
 */
export function renderAPIUsageBadge(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const usage = getAPIUsage();
    const status = getUsageStatus(usage.percentage);
    
    const statusColors = {
        good: '#10b981',
        warning: '#f59e0b',
        critical: '#ef4444'
    };
    
    container.innerHTML = `
        <div class="api-usage-badge" style="
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.2s ease;
        " title="SeaRates API Usage">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${statusColors[status]}" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
            </svg>
            <span style="font-size: 0.875rem; font-weight: 600; color: var(--text-color);">
                ${usage.remaining}/${MONTHLY_LIMIT}
            </span>
        </div>
    `;
    
    // Add hover effect
    const badge = container.querySelector('.api-usage-badge') as HTMLElement;
    if (badge) {
        badge.addEventListener('mouseenter', () => {
            badge.style.transform = 'translateY(-2px)';
            badge.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        });
        badge.addEventListener('mouseleave', () => {
            badge.style.transform = 'translateY(0)';
            badge.style.boxShadow = 'none';
        });
    }
}

/**
 * Show API usage modal with detailed information
 */
export function showAPIUsageModal(): void {
    const usage = getAPIUsage();
    const status = getUsageStatus(usage.percentage);
    
    const statusColors = {
        good: '#10b981',
        warning: '#f59e0b',
        critical: '#ef4444'
    };
    
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'api-usage-modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(4px);
    `;
    
    modalOverlay.innerHTML = `
        <div style="
            background: var(--card-bg);
            border-radius: 16px;
            padding: 2rem;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0; color: var(--text-color);">API Usage Details</h3>
                <button id="close-usage-modal" style="
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: var(--text-muted);
                ">&times;</button>
            </div>
            
            <div id="modal-widget-container"></div>
            
            <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
                <h4 style="margin: 0 0 1rem 0; font-size: 0.875rem; color: var(--text-muted);">
                    SERVICE BREAKDOWN
                </h4>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--text-color);">🚢 FCL Container Quotes</span>
                        <span style="color: ${statusColors.good}; font-weight: 600;">✓ Real-time</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--text-color);">📦 LCL Ocean Freight</span>
                        <span style="color: ${statusColors.good}; font-weight: 600;">✓ Real-time</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--text-color);">✈️ Air Freight</span>
                        <span style="color: ${statusColors.good}; font-weight: 600;">✓ Real-time</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--text-color);">🚂 Railway Freight</span>
                        <span style="color: ${statusColors.warning}; font-weight: 600;">○ AI Estimate</span>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 1.5rem;">
                <p style="margin: 0; font-size: 0.75rem; color: var(--text-muted); line-height: 1.6;">
                    <strong>Note:</strong> When API quota is exhausted, all services automatically switch to 
                    AI-powered estimates. Customer contact information is captured for manual rate confirmation 
                    within 24 hours.
                </p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalOverlay);
    
    // Render widget inside modal
    renderAPIUsageWidget('modal-widget-container');
    
    // Close modal handlers
    const closeBtn = document.getElementById('close-usage-modal');
    closeBtn?.addEventListener('click', () => {
        document.body.removeChild(modalOverlay);
    });
    
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            document.body.removeChild(modalOverlay);
        }
    });
}
