// analytics.ts - Google Analytics 4 Integration
declare global {
    interface Window {
        dataLayer: any[];
        gtag: (...args: any[]) => void;
    }
}

// Google Analytics Measurement ID (user should replace with their own)
const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // Replace with your GA4 Measurement ID

/**
 * Initialize Google Analytics 4
 */
export function initializeAnalytics(): void {
    // Only initialize if Measurement ID is set
    if (GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') {
        console.log('Google Analytics not configured. Add your Measurement ID in analytics.ts');
        return;
    }

    // Load gtag.js script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    // Initialize dataLayer
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() {
        window.dataLayer.push(arguments);
    };

    // Configure Analytics
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, {
        'send_page_view': true,
        'cookie_flags': 'SameSite=None;Secure'
    });

    console.log('Google Analytics initialized');
}

/**
 * Track page view
 */
export function trackPageView(pageName: string): void {
    if (typeof window.gtag === 'function') {
        window.gtag('event', 'page_view', {
            'page_title': pageName,
            'page_location': window.location.href,
            'page_path': window.location.pathname + window.location.hash
        });
    }
}

/**
 * Track quote request event
 */
export function trackQuoteRequest(service: string, origin: string, destination: string): void {
    if (typeof window.gtag === 'function') {
        window.gtag('event', 'quote_request', {
            'event_category': 'engagement',
            'event_label': service,
            'service_type': service,
            'origin': origin,
            'destination': destination
        });
    }
}

/**
 * Track booking/payment event
 */
export function trackBooking(service: string, amount: number, currency: string): void {
    if (typeof window.gtag === 'function') {
        window.gtag('event', 'purchase', {
            'transaction_id': `VCS-${Date.now()}`,
            'value': amount,
            'currency': currency,
            'items': [{
                'item_name': service,
                'item_category': 'Shipping Service',
                'price': amount,
                'quantity': 1
            }]
        });
    }
}

/**
 * Track user signup
 */
export function trackSignup(method: string): void {
    if (typeof window.gtag === 'function') {
        window.gtag('event', 'sign_up', {
            'method': method
        });
    }
}

/**
 * Track user login
 */
export function trackLogin(method: string): void {
    if (typeof window.gtag === 'function') {
        window.gtag('event', 'login', {
            'method': method
        });
    }
}

/**
 * Track custom event
 */
export function trackCustomEvent(eventName: string, parameters?: Record<string, any>): void {
    if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, parameters || {});
    }
}
